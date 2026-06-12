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

function systemPrompt(task) {
  if (task === 'ai_decision') {
    return [
      'You are a Texas Holdem player agent.',
      'Use only the scoped observation supplied in the payload.',
      'Choose one legal action from the payload and give a concise rationale.',
      'Return thinkingProcess as 2-4 concise public reasoning summary steps, not hidden chain-of-thought.',
      'Do not mention hidden cards you were not given.',
    ].join(' ');
  }

  if (task === 'coach_advice') {
    return [
      'You are a poker coach for the human player.',
      'Use only the human hand, public table, legal actions, and local equity summary supplied.',
      'Return concise advice for each legal option.',
      'Return thinkingProcess as 2-4 concise public reasoning summary steps, not hidden chain-of-thought.',
    ].join(' ');
  }

  return [
    'You are a poker report agent.',
    'You may use the complete post-hand history, records, and decision traces supplied.',
    'Return a comprehensive but concise learning review.',
    'Return thinkingProcess as 2-5 concise public reasoning summary steps, not hidden chain-of-thought.',
  ].join(' ');
}

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
      input: [
        { role: 'system', content: systemPrompt(task) },
        { role: 'user', content: JSON.stringify(payload) },
      ],
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
      if (!['ai_decision', 'coach_advice', 'hand_report'].includes(body.task)) {
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
