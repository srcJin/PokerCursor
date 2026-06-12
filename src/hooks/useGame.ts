import { useCallback, useMemo, useState } from 'react';
import type { Action } from '../types/poker';

import { getCoachAdvice, getCoachFeedback } from '../agents/coach';
import { GameSession } from '../game/GameSession';
import { HUMAN_SEAT } from '../game/constants';
import type { CoachAdvice, HandReport, TableView } from '../types/game';

export type GamePhase = 'lobby' | 'playing' | 'hand_complete';

export function useGame() {
  const [session, setSession] = useState<GameSession | null>(null);
  const [phase, setPhase] = useState<GamePhase>('lobby');
  const [tick, setTick] = useState(0);
  const [coachAdvice, setCoachAdvice] = useState<CoachAdvice | null>(null);
  const [coachFeedback, setCoachFeedback] = useState<string | null>(null);
  const [handReport, setHandReport] = useState<HandReport | null>(null);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const view: TableView | null = useMemo(() => {
    void tick;
    return session?.getView(phase === 'hand_complete') ?? null;
  }, [session, phase, tick]);

  const startGame = useCallback(() => {
    const next = new GameSession();
    next.startHand();
    const result = next.advanceUntilHumanOrComplete();
    setSession(next);
    setCoachAdvice(null);
    setCoachFeedback(null);
    setHandReport(null);
    setPhase(result === 'hand_complete' ? 'hand_complete' : 'playing');
    if (result === 'hand_complete') {
      setHandReport(next.finalizeHandReport());
    }
    refresh();
  }, [refresh]);

  const askCoach = useCallback(() => {
    if (!session || !view?.humanToAct) return;
    setCoachAdvice(getCoachAdvice(view));
    setCoachFeedback(null);
  }, [session, view]);

  const humanAction = useCallback(
    (action: Action, betSize?: number) => {
      if (!session || !view?.humanToAct) return;

      setCoachFeedback(getCoachFeedback(action, view));
      setCoachAdvice(null);
      session.act(HUMAN_SEAT, action, betSize);
      const result = session.advanceUntilHumanOrComplete();
      if (result === 'hand_complete') {
        setHandReport(session.finalizeHandReport());
        setPhase('hand_complete');
      }
      refresh();
    },
    [session, view, refresh],
  );

  const nextHand = useCallback(() => {
    if (!session) return;
    session.startHand();
    const result = session.advanceUntilHumanOrComplete();
    setCoachAdvice(null);
    setCoachFeedback(null);
    setHandReport(null);
    setPhase(result === 'hand_complete' ? 'hand_complete' : 'playing');
    if (result === 'hand_complete') {
      setHandReport(session.finalizeHandReport());
    }
    refresh();
  }, [session, refresh]);

  return {
    phase,
    view,
    coachAdvice,
    coachFeedback,
    handReport,
    startGame,
    askCoach,
    humanAction,
    nextHand,
  };
}
