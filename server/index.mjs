import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

function loadDotEnv() {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (!process.env[key]) {
      process.env[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
    }
  }
}

loadDotEnv();

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '127.0.0.1';
const MODEL = process.env.OPENAI_MODEL ?? 'gpt-5-mini';
const DIST_DIR = join(process.cwd(), 'dist');

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, body) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function extractOutputText(response) {
  if (typeof response.output_text === 'string') {
    return response.output_text;
  }

  const chunks = [];
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && content.text) {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join('\n');
}

const AI_PLAYER_PROMPT = `You are a poker player agent in a Texas Hold'em learning app. You play like a believable human — not perfectly, not randomly. You are governed by profile attributes in the payload: stack_size, aggression (0-10), loss_aversion (0-10), bluff_index (0-10), position, and recent_history. Play a plausible range for your position. Occasionally make a slightly irrational call (roughly 1 in 8 decisions). If loss_aversion > 6 and recent_history shows heavy losses, reduce aggression. Never announce hidden cards or strategy. Choose one legal action from the payload view.`;

const ASSISTANT_PROMPT = `You do not speak first. You wait until the player asks during their turn. You can only see the human player's hole cards, community cards, pot size, current bet, and player stack. You cannot see opponent hole cards. Help with pot odds, equity estimates, fold/call/raise suggestions, and danger flags. Only respond when asked. 1-3 sentences max. Never be definitive. Format: [ASSISTANT]: <response>`;

const COACH_REVIEW_PROMPT = `You are a professional poker coach. You only speak after a street or hand has completed — never during an active hand. You have full visibility into all players' hole cards, actions, pot sizes, and community cards. When reviewing: cover what the human did, what they should consider differently, and one opponent read. Format opening reviews as [PRO COACH – STREET]: and follow-ups as [PRO COACH]:`;

const SESSION_REPORT_PROMPT = `You write end-of-session poker learning summaries covering what the player did well, what to work on, and three specific spots to review. Keep it under 200 words.`;

function schemaForTask(task) {
  if (task === 'ai_decision') {
    return {
      name: 'ai_decision',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['action', 'betSize', 'rationale', 'thinkingProcess'],
        properties: {
          action: { type: 'string', enum: ['fold', 'check', 'call', 'bet', 'raise'] },
          betSize: { type: ['number', 'null'] },
          rationale: { type: 'string' },
          thinkingProcess: { type: 'array', items: { type: 'string' } },
        },
      },
    };
  }

  if (task === 'coach_advice') {
    return {
      name: 'coach_advice',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['summary', 'equity', 'options', 'thinkingProcess'],
        properties: {
          summary: { type: 'string' },
          equity: { type: ['string', 'null'] },
          thinkingProcess: { type: 'array', items: { type: 'string' } },
          options: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['action', 'label', 'rationale'],
              properties: {
                action: { type: 'string', enum: ['fold', 'check', 'call', 'bet', 'raise'] },
                label: { type: 'string' },
                rationale: { type: 'string' },
              },
            },
          },
        },
      },
    };
  }

  if (task === 'assistant_chat' || task === 'coach_review' || task === 'coach_chat') {
    return {
      name: `${task}_response`,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['reply'],
        properties: {
          reply: { type: 'string' },
        },
      },
    };
  }

  if (task === 'session_report') {
    return {
      name: 'session_report',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['summary'],
        properties: {
          summary: { type: 'string' },
        },
      },
    };
  }

  return {
    name: 'hand_report',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'highlights', 'improvements', 'timeline', 'decisionReviews', 'thinkingProcess'],
      properties: {
        summary: { type: 'string' },
        highlights: { type: 'array', items: { type: 'string' } },
        improvements: { type: 'array', items: { type: 'string' } },
        timeline: { type: 'array', items: { type: 'string' } },
        decisionReviews: { type: 'array', items: { type: 'string' } },
        thinkingProcess: { type: 'array', items: { type: 'string' } },
      },
    },
  };
}

function systemPrompt(task, payload = {}) {
  if (task === 'ai_decision') {
    return AI_PLAYER_PROMPT;
  }

  if (task === 'coach_advice') {
    return [
      'You are a poker coach for the human player.',
      'Use only the human hand, public table, legal actions, and local equity summary supplied.',
      'Return concise advice for each legal option.',
      'Return thinkingProcess as 2-4 concise public reasoning summary steps, not hidden chain-of-thought.',
    ].join(' ');
  }

  if (task === 'assistant_chat') {
    return payload.system ?? ASSISTANT_PROMPT;
  }

  if (task === 'coach_review' || task === 'coach_chat') {
    return payload.system ?? COACH_REVIEW_PROMPT;
  }

  if (task === 'session_report') {
    return SESSION_REPORT_PROMPT;
  }

  return [
    'You are a poker report agent.',
    'You may use the complete post-hand history, records, and decision traces supplied.',
    'Return a comprehensive but concise learning review.',
    'Return thinkingProcess as 2-5 concise public reasoning summary steps, not hidden chain-of-thought.',
  ].join(' ');
}

function buildInput(task, payload) {
  if (task === 'coach_review') {
    return [
      { role: 'system', content: systemPrompt(task, payload) },
      { role: 'user', content: payload.userMessage ?? JSON.stringify(payload) },
    ];
  }

  if (task === 'assistant_chat' || task === 'coach_chat') {
    const messages = payload.messages ?? [];
    return [
      { role: 'system', content: systemPrompt(task, payload) },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];
  }

  return [
    { role: 'system', content: systemPrompt(task, payload) },
    { role: 'user', content: JSON.stringify(payload) },
  ];
}

const ALLOWED_TASKS = [
  'ai_decision',
  'coach_advice',
  'hand_report',
  'assistant_chat',
  'coach_review',
  'coach_chat',
  'session_report',
];

async function callOpenAI(task, payload) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      ok: false,
      status: 503,
      error: 'OPENAI_API_KEY is not configured on the backend.',
    };
  }

  const format = schemaForTask(task);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      input: buildInput(task, payload),
      text: {
        format: {
          type: 'json_schema',
          ...format,
          strict: true,
        },
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: data.error?.message ?? 'OpenAI request failed.',
    };
  }

  const text = extractOutputText(data);
  return {
    ok: true,
    status: 200,
    result: JSON.parse(text),
  };
}

async function serveStatic(req, res) {
  const rawPath = new URL(req.url ?? '/', `http://localhost:${PORT}`).pathname;
  const safePath = normalize(rawPath === '/' ? '/index.html' : rawPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(DIST_DIR, safePath);

  try {
    const file = await readFile(filePath);
    res.writeHead(200, { 'content-type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream' });
    res.end(file);
  } catch {
    const index = await readFile(join(DIST_DIR, 'index.html'));
    res.writeHead(200, { 'content-type': MIME_TYPES['.html'] });
    res.end(index);
  }
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.url === '/api/agent' && req.method === 'POST') {
    try {
      const body = await readJson(req);
      if (!ALLOWED_TASKS.includes(body.task)) {
        sendJson(res, 400, { ok: false, error: 'Unknown agent task.' });
        return;
      }

      const result = await callOpenAI(body.task, body.payload);
      sendJson(res, result.status, result.ok
        ? { ok: true, result: result.result }
        : { ok: false, error: result.error });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : 'Server error.' });
    }
    return;
  }

  if (req.method === 'GET') {
    await serveStatic(req, res);
    return;
  }

  sendJson(res, 404, { ok: false, error: 'Not found.' });
}).listen(PORT, HOST, () => {
  console.log(`PokerCursor backend listening on http://${HOST}:${PORT}`);
});
