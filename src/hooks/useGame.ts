import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Action } from '../types/poker';

import { getCoachAdvice, getCoachFeedback } from '../agents/coach';
import { CoachReview } from '../agents/coachReview';
import { dealerTimers, type TimerHandle } from '../agents/dealer';
import {
  requestAIDecision,
  requestAssistantChat,
  requestCoachFollowUp,
  requestCoachStreetReview,
  requestHandReport,
} from '../agents/llmClient';
import { GameSession } from '../game/GameSession';
import { HUMAN_SEAT } from '../game/constants';
import type {
  AgentDecisionTrace,
  AgentMemorySnapshot,
  ChatMessage,
  CoachAdvice,
  HandReport,
  PlayerRecord,
  Street,
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
  const [assistantHistory, setAssistantHistory] = useState<ChatMessage[]>([]);
  const [coachHistory, setCoachHistory] = useState<ChatMessage[]>([]);
  const [handLog, setHandLog] = useState<string[]>([]);
  const [clockWarning, setClockWarning] = useState<string | null>(null);

  const coachReviewRef = useRef(new CoachReview());
  const playerTimerRef = useRef<TimerHandle | null>(null);
  const reportSeqRef = useRef(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const clearPlayerTimer = useCallback(() => {
    playerTimerRef.current?.clear();
    playerTimerRef.current = null;
  }, []);

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
    setHandReport(localReport);
    setSavedRecords(records);
    saveRecords(records);
    setHandLog((log) => [
      ...log,
      ...nextSession.getActionLog().map(
        (entry) => `${entry.street}: ${entry.player} ${entry.action}`,
      ),
    ]);
    setPhase('hand_complete');
    clearPlayerTimer();
    setClockWarning(null);

    // Upgrade to the LLM-written report in the background; drop the result
    // if a new hand has started in the meantime.
    const seq = reportSeqRef.current;
    void requestHandReport(
      localReport,
      records,
      nextSession.getDecisionTraces(),
    ).then((report) => {
      if (reportSeqRef.current === seq && report !== localReport) {
        setHandReport(report);
      }
    });
  }, [clearPlayerTimer]);

  const startPlayerClock = useCallback((activeSession: GameSession) => {
    clearPlayerTimer();
    const currentView = activeSession.getView(false);
    if (!currentView.humanToAct) return;

    playerTimerRef.current = dealerTimers.startPlayerTimer(
      () => {
        activeSession.act(HUMAN_SEAT, 'fold', undefined, 'Auto-folded on clock expiry.');
        void (async () => {
          const result = await activeSession.advanceUntilHumanOrComplete(requestAIDecision);
          setSession(activeSession);
          if (result === 'hand_complete') {
            await completeHand(activeSession);
          }
          setClockWarning('[DEALER]: Time expired — auto-fold.');
          refresh();
        })();
      },
      () => {
        setClockWarning('[DEALER]: 20 seconds remaining on your clock.');
      },
    );
  }, [clearPlayerTimer, completeHand, refresh]);

  const startHandFlow = useCallback(async (next: GameSession) => {
    reportSeqRef.current += 1;
    setAssistantHistory([]);
    setCoachAdvice(null);
    setCoachFeedback(null);
    setHandReport(null);
    setClockWarning(null);

    const result = await next.advanceUntilHumanOrComplete(requestAIDecision);
    setSession(next);
    setPhase(result === 'hand_complete' ? 'hand_complete' : 'playing');
    if (result === 'hand_complete') {
      await completeHand(next);
    } else if (result === 'human_turn') {
      startPlayerClock(next);
    }
    refresh();
  }, [completeHand, refresh, startPlayerClock]);

  const startGame = useCallback(async () => {
    setIsThinking(true);
    try {
      coachReviewRef.current.resetChatHistory();
      setCoachHistory([]);
      const next = new GameSession(savedRecords);
      next.startHand();
      await startHandFlow(next);
    } finally {
      setIsThinking(false);
    }
  }, [savedRecords, startHandFlow]);

  const askCoach = useCallback(async () => {
    if (!session || !view?.humanToAct) return;
    setIsThinking(true);
    const localAdvice = getCoachAdvice(view);
    setCoachAdvice(localAdvice);
    setCoachFeedback(null);
    session.recordCoachAdvice(localAdvice.summary);
    setIsThinking(false);
    refresh();
  }, [session, view, refresh]);

  const askAssistant = useCallback(async (userMessage: string) => {
    if (!view) return ASSISTANT_IDLE_FALLBACK;

    const reply = await requestAssistantChat(view, userMessage, assistantHistory);
    setAssistantHistory((history) => [
      ...history,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: reply },
    ]);
    return reply;
  }, [view, assistantHistory]);

  const assistantChat = askAssistant;

  const askCoachReview = useCallback(async () => {
    if (!session || !view || view.handInProgress) {
      return "Hand is still live — I'll break it down once this street closes. Stay focused.";
    }

    setIsThinking(true);
    coachReviewRef.current.resetChatHistory();
    setCoachHistory([]);

    const review = await requestCoachStreetReview(
      coachReviewRef.current,
      view,
      session.getActionLog(),
      (view.street ?? 'river') as Street,
    );
    setCoachHistory(coachReviewRef.current.getChatHistory());
    setIsThinking(false);
    return review;
  }, [session, view]);

  const coachChat = useCallback(async (userMessage: string) => {
    if (!session || !view || view.handInProgress) {
      const reply = "Hand is still live — I'll break it down once this street closes. Stay focused.";
      setCoachHistory((history) => [
        ...history,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: reply },
      ]);
      return reply;
    }

    setIsThinking(true);
    const reply = await requestCoachFollowUp(
      coachReviewRef.current,
      view,
      session.getActionLog(),
      userMessage,
      coachHistory,
    );
    setCoachHistory(coachReviewRef.current.getChatHistory());
    setIsThinking(false);
    return reply;
  }, [session, view, coachHistory]);

  const humanAction = useCallback(
    async (action: Action, betSize?: number) => {
      if (!session || !view?.humanToAct) return;

      setIsThinking(true);
      try {
        clearPlayerTimer();
        setClockWarning(null);
        const feedback = getCoachFeedback(action, view);
        setCoachFeedback(feedback);
        setCoachAdvice(null);
        session.act(HUMAN_SEAT, action, betSize, feedback);
        const result = await session.advanceUntilHumanOrComplete(requestAIDecision);
        if (result === 'hand_complete') {
          await completeHand(session);
        } else if (result === 'human_turn') {
          startPlayerClock(session);
        }
      } finally {
        setIsThinking(false);
        refresh();
      }
    },
    [clearPlayerTimer, completeHand, session, startPlayerClock, view, refresh],
  );

  const nextHand = useCallback(async () => {
    if (!session) return;
    setIsThinking(true);
    try {
      coachReviewRef.current.resetChatHistory();
      setCoachHistory([]);
      session.startHand();
      await startHandFlow(session);
    } finally {
      setIsThinking(false);
    }
  }, [session, startHandFlow]);

  useEffect(() => () => clearPlayerTimer(), [clearPlayerTimer]);

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
    assistantHistory,
    coachHistory,
    handLog,
    clockWarning,
    startGame,
    askCoach,
    askAssistant,
    askCoachReview,
    assistantChat,
    coachChat,
    humanAction,
    nextHand,
  };
}

const ASSISTANT_IDLE_FALLBACK =
  'I can only help during a hand. Ask the Pro Coach for post-hand review.';
