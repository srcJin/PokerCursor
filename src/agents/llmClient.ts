import {
  buildAIDecisionTrace,
  type AIDecision,
  type AIDecisionResult,
  summarizeObservation,
} from './aiPlayer';
import type {
  AgentMemorySnapshot,
  CoachAdvice,
  HandReport,
  PlayerRecord,
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
  const result = await callLLM<{
    action: string;
    betSize: number | null;
    rationale: string;
    thinkingProcess: string[];
  }>('ai_decision', {
    seat,
    view,
    memory,
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
