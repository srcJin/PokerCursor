import {
  buildAIDecisionTrace,
  getAgentProfile,
  type AIDecision,
  type AIDecisionResult,
  summarizeObservation,
} from './aiPlayer';
import {
  ASSISTANT_IDLE_RESPONSE,
  buildAssistantPayload,
  formatAssistantReply,
  gateAssistantMessage,
} from './assistant';
import {
  CoachReview,
  formatCoachChatReply,
  formatCoachReviewReply,
  gateCoachReview,
} from './coachReview';
import type {
  ActionLogEntry,
  AgentMemorySnapshot,
  ChatMessage,
  CoachAdvice,
  HandReport,
  PlayerRecord,
  Street,
  TableView,
} from '../types/game';

interface LLMResponse<T> {
  ok: boolean;
  result?: T;
  error?: string;
}

async function callLLM<T>(task: string, payload: unknown): Promise<T | null> {
  try {
    const response = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, payload }),
    });

    const data = await response.json() as LLMResponse<T>;
    if (!response.ok || !data.ok || !data.result) {
      console.warn(data.error ?? 'LLM request failed');
      return null;
    }
    return data.result;
  } catch (error) {
    console.warn('LLM request failed', error);
    return null;
  }
}

export async function requestAIDecision(
  seat: number,
  view: TableView,
  memory: AgentMemorySnapshot,
  fallback: AIDecisionResult,
): Promise<AIDecisionResult> {
  const profile = getAgentProfile(seat, view, memory);
  const result = await callLLM<{
    action: string;
    betSize: number | null;
    rationale: string;
    thinkingProcess: string[];
  }>('ai_decision', {
    seat,
    view,
    memory,
    profile,
  });

  if (!result || !view.legalActions.includes(result.action as AIDecision['action'])) {
    return fallback;
  }

  const player = view.seats.find((item) => item.seat === seat);
  const cards = player?.holeCards?.filter((card) => card !== 'back') ?? [];
  const betSize = result.betSize && view.chipRange
    ? Math.min(view.chipRange.max, Math.max(view.chipRange.min, result.betSize))
    : undefined;
  const decision: AIDecision = {
    action: result.action as AIDecision['action'],
    betSize,
    rationale: `LLM: ${result.rationale}`,
    thinkingProcess: result.thinkingProcess?.length
      ? result.thinkingProcess.map((step) => `LLM: ${step}`)
      : fallback.decision.thinkingProcess,
    observation: summarizeObservation(view, seat, cards),
  };

  return {
    decision,
    trace: buildAIDecisionTrace(decision, seat, view, memory, cards),
  };
}

export async function requestCoachAdvice(
  view: TableView,
  localAdvice: CoachAdvice,
): Promise<CoachAdvice> {
  const result = await callLLM<CoachAdvice>('coach_advice', {
    view,
    localAdvice,
  });

  if (!result || !Array.isArray(result.options)) {
    return localAdvice;
  }

  return {
    summary: result.summary || localAdvice.summary,
    options: result.options.length ? result.options : localAdvice.options,
    equity: result.equity ?? localAdvice.equity,
    thinkingProcess: result.thinkingProcess?.length
      ? result.thinkingProcess.map((step) => `LLM: ${step}`)
      : localAdvice.thinkingProcess,
  };
}

export async function requestHandReport(
  localReport: HandReport,
  records: PlayerRecord[],
  traces: unknown[],
): Promise<HandReport> {
  const result = await callLLM<HandReport>('hand_report', {
    localReport,
    records,
    traces,
  });

  if (!result) {
    return localReport;
  }

  return {
    highlights: result.highlights?.length ? result.highlights : localReport.highlights,
    improvements: result.improvements?.length ? result.improvements : localReport.improvements,
    summary: result.summary || localReport.summary,
    timeline: result.timeline?.length ? result.timeline : localReport.timeline,
    decisionReviews: result.decisionReviews?.length
      ? result.decisionReviews
      : localReport.decisionReviews,
    thinkingProcess: result.thinkingProcess?.length
      ? result.thinkingProcess.map((step) => `LLM: ${step}`)
      : localReport.thinkingProcess,
  };
}

export async function requestAssistantChat(
  view: TableView,
  userMessage: string,
  history: ChatMessage[],
): Promise<string> {
  const gate = gateAssistantMessage(view, userMessage);
  if (!gate.allowed) {
    return gate.reply;
  }

  const payload = buildAssistantPayload(view, gate.userMessage, history);
  const result = await callLLM<{ reply: string }>('assistant_chat', payload);
  if (!result?.reply) {
    return formatAssistantReply(
      'Consider pot odds against your draw or made hand strength before continuing.',
    );
  }
  return formatAssistantReply(result.reply);
}

export async function requestCoachStreetReview(
  coach: CoachReview,
  view: TableView,
  actionLog: ActionLogEntry[],
  street: Street | null,
): Promise<string> {
  const gate = gateCoachReview(view);
  if (!gate.allowed) {
    return gate.reply;
  }

  const request = coach.buildReviewRequest(view, actionLog, street);
  const result = await callLLM<{ reply: string }>('coach_review', request);
  const reply = formatCoachReviewReply(
    result?.reply ?? 'Review the pot odds and position on each street before acting.',
    street,
  );
  coach.recordReview(reply);
  return reply;
}

export async function requestCoachFollowUp(
  coach: CoachReview,
  view: TableView,
  actionLog: ActionLogEntry[],
  userMessage: string,
  conversationHistory: ChatMessage[],
): Promise<string> {
  const gate = gateCoachReview(view);
  if (!gate.allowed) {
    coach.recordChat(userMessage, gate.reply);
    return gate.reply;
  }

  const request = coach.buildChatRequest(view, actionLog, userMessage, conversationHistory);
  const result = await callLLM<{ reply: string }>('coach_chat', request);
  const reply = formatCoachChatReply(
    result?.reply ?? 'Focus on how your line interacted with the board texture and bet sizing.',
  );
  coach.recordChat(userMessage, reply);
  return reply;
}

export async function requestSessionReport(
  view: TableView,
  actionLog: ActionLogEntry[],
  handLog: string[],
): Promise<string> {
  const result = await callLLM<{ summary: string }>('session_report', {
    view,
    actionLog,
    handLog,
  });
  return result?.summary ?? 'Keep reviewing aggressive spots and fold discipline between sessions.';
}

export { ASSISTANT_IDLE_RESPONSE };
