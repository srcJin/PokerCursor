import { useCallback, useMemo, useState } from 'react';
import type { Action } from '../types/poker';

import { getCoachAdvice, getCoachFeedback } from '../agents/coach';
import { requestAIDecision, requestCoachAdvice, requestHandReport } from '../agents/llmClient';
import { GameSession } from '../game/GameSession';
import { HUMAN_SEAT } from '../game/constants';
import type {
  AgentDecisionTrace,
  AgentMemorySnapshot,
  CoachAdvice,
  HandReport,
  PlayerRecord,
  TableView,
} from '../types/game';

export type GamePhase = 'lobby' | 'playing' | 'hand_complete';

const RECORDS_KEY = 'pokercursor.records.v1';

function loadSavedRecords(): PlayerRecord[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(RECORDS_KEY);
    return raw ? JSON.parse(raw) as PlayerRecord[] : [];
  } catch {
    return [];
  }
}

function saveRecords(records: PlayerRecord[]): void {
  try {
    window.localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    // Local storage is optional for the demo; in-memory records still work.
  }
}

export function useGame() {
  const [session, setSession] = useState<GameSession | null>(null);
  const [phase, setPhase] = useState<GamePhase>('lobby');
  const [tick, setTick] = useState(0);
  const [coachAdvice, setCoachAdvice] = useState<CoachAdvice | null>(null);
  const [coachFeedback, setCoachFeedback] = useState<string | null>(null);
  const [handReport, setHandReport] = useState<HandReport | null>(null);
  const [savedRecords, setSavedRecords] = useState<PlayerRecord[]>(loadSavedRecords);
  const [isThinking, setIsThinking] = useState(false);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const view: TableView | null = useMemo(() => {
    void tick;
    return session?.getView(phase === 'hand_complete') ?? null;
  }, [session, phase, tick]);

  const agentMemories: AgentMemorySnapshot[] = useMemo(() => {
    void tick;
    return session?.getAgentMemories() ?? [];
  }, [session, tick]);

  const decisionTraces: AgentDecisionTrace[] = useMemo(() => {
    void tick;
    return session?.getDecisionTraces() ?? [];
  }, [session, tick]);

  const playerRecords: PlayerRecord[] = useMemo(() => {
    void tick;
    return session?.getPlayerRecords() ?? savedRecords;
  }, [session, savedRecords, tick]);

  const completeHand = useCallback(async (nextSession: GameSession) => {
    const localReport = nextSession.finalizeHandReport();
    const records = nextSession.getPlayerRecords();
    const report = await requestHandReport(
      localReport,
      records,
      nextSession.getDecisionTraces(),
    );
    setHandReport(report);
    setSavedRecords(records);
    saveRecords(records);
    setPhase('hand_complete');
  }, []);

  const startGame = useCallback(async () => {
    setIsThinking(true);
    const next = new GameSession(savedRecords);
    next.startHand();
    const result = await next.advanceUntilHumanOrComplete(requestAIDecision);
    setSession(next);
    setCoachAdvice(null);
    setCoachFeedback(null);
    setHandReport(null);
    setPhase(result === 'hand_complete' ? 'hand_complete' : 'playing');
    if (result === 'hand_complete') {
      await completeHand(next);
    }
    setIsThinking(false);
    refresh();
  }, [completeHand, refresh, savedRecords]);

  const askCoach = useCallback(async () => {
    if (!session || !view?.humanToAct) return;
    setIsThinking(true);
    const localAdvice = getCoachAdvice(view);
    const advice = await requestCoachAdvice(view, localAdvice);
    session.recordCoachAdvice(advice.summary);
    setCoachAdvice(advice);
    setCoachFeedback(null);
    setIsThinking(false);
    refresh();
  }, [session, view, refresh]);

  const humanAction = useCallback(
    async (action: Action, betSize?: number) => {
      if (!session || !view?.humanToAct) return;

      setIsThinking(true);
      const feedback = getCoachFeedback(action, view);
      setCoachFeedback(feedback);
      setCoachAdvice(null);
      session.act(HUMAN_SEAT, action, betSize, feedback);
      const result = await session.advanceUntilHumanOrComplete(requestAIDecision);
      if (result === 'hand_complete') {
        await completeHand(session);
      }
      setIsThinking(false);
      refresh();
    },
    [completeHand, session, view, refresh],
  );

  const nextHand = useCallback(async () => {
    if (!session) return;
    setIsThinking(true);
    session.startHand();
    const result = await session.advanceUntilHumanOrComplete(requestAIDecision);
    setCoachAdvice(null);
    setCoachFeedback(null);
    setHandReport(null);
    setPhase(result === 'hand_complete' ? 'hand_complete' : 'playing');
    if (result === 'hand_complete') {
      await completeHand(session);
    }
    setIsThinking(false);
    refresh();
  }, [completeHand, session, refresh]);

  return {
    phase,
    view,
    agentMemories,
    decisionTraces,
    playerRecords,
    isThinking,
    coachAdvice,
    coachFeedback,
    handReport,
    startGame,
    askCoach,
    humanAction,
    nextHand,
  };
}
