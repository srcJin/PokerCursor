import type { Action } from '../types/poker';
import PokerTable from './pokerTable';

import { pickAIAction, type AIDecisionResult } from '../agents/aiPlayer';
import { dealerTimers, endHand, formatDealerMessage, startNewHand } from '../agents/dealer';
import { AgentMemoryManager } from '../agents/memory';
import { buildHandReport } from '../agents/report';
import type {
  ActionLogEntry,
  AgentDecisionTrace,
  AgentId,
  AgentMemorySnapshot,
  HandReport,
  PlayerRecord,
  SeatView,
  Street,
  TableView,
  WinnerView,
} from '../types/game';
import { cardsToShort } from './cards';
import {
  ACTIVE_SEATS,
  AI_AGGRESSIVE_SEAT,
  AI_CONSERVATIVE_SEAT,
  HAND_RANKING_NAMES,
  HUMAN_SEAT,
  SEAT_CONFIG,
  STARTING_STACK,
  TABLE_SEATS,
} from './constants';

export type AdvanceResult =
  | 'human_turn'
  | 'hand_complete'
  | 'waiting';

export type AIDecisionProvider = (
  seat: number,
  view: TableView,
  memory: AgentMemorySnapshot,
  fallback: AIDecisionResult,
) => Promise<AIDecisionResult>;

import type { PokerTableInstance } from './pokerTable';

export class GameSession {
  private table: PokerTableInstance;
  private actionLog: ActionLogEntry[] = [];
  private decisionTraces: AgentDecisionTrace[] = [];
  private lastHandReport: HandReport | null = null;
  private completedHandView: TableView | null = null;
  private memory = new AgentMemoryManager();
  private records = new Map<number, PlayerRecord>();
  // poker-ts forbids reading pots() once the hand ends, so keep the last
  // in-progress snapshot for uncontested-winner resolution.
  private lastPots: { size: number; eligiblePlayers: number[] }[] = [];
  private readonly fastMode: boolean;

  constructor(savedRecords: PlayerRecord[] = [], fastMode = import.meta.env.MODE === 'test') {
    this.fastMode = fastMode;
    this.table = new PokerTable({ smallBlind: 1, bigBlind: 2 }, TABLE_SEATS);
    for (const seat of ACTIVE_SEATS) {
      const saved = savedRecords.find((record) => record.seat === seat);
      const credits = saved && saved.credits > 0 ? saved.credits : STARTING_STACK;
      this.table.sitDown(seat, credits);
      this.records.set(seat, this.createPlayerRecord(seat, credits, saved));
    }
  }

  getActionLog(): ActionLogEntry[] {
    return [...this.actionLog];
  }

  getLastHandReport(): HandReport | null {
    return this.lastHandReport;
  }

  getAgentMemories(): AgentMemorySnapshot[] {
    return this.memory.getAllSnapshots();
  }

  getDecisionTraces(): AgentDecisionTrace[] {
    return [...this.decisionTraces];
  }

  getPlayerRecords(): PlayerRecord[] {
    return Array.from(this.records.values()).map((record) => ({
      ...record,
      recentResults: [...record.recentResults],
    }));
  }

  startHand(): void {
    this.actionLog = [];
    this.decisionTraces = [];
    this.lastHandReport = null;
    this.completedHandView = null;
    this.memory.resetHand();
    startNewHand(this.table);
    this.recordAgentTrace(
      'dealer',
      undefined,
      formatDealerMessage('Button rotated. Hole cards dealt. Blinds posted.'),
      this.getScopedView('dealer'),
    );
  }

  getView(revealAllCards = false): TableView {
    if (!this.table.isHandInProgress() && this.completedHandView) {
      return this.completedHandView;
    }

    const handInProgress = this.table.isHandInProgress();
    const street = handInProgress ? this.table.roundOfBetting() : null;
    const playerToAct = handInProgress && this.table.isBettingRoundInProgress()
      ? this.table.playerToAct()
      : -1;
    const button = handInProgress ? this.table.button() : -1;
    const holeCards = handInProgress || this.hasShowdownCards()
      ? this.table.holeCards()
      : [];

    const seats: SeatView[] = Array.from({ length: TABLE_SEATS }, (_, seat) => {
      const config = SEAT_CONFIG[seat];
      if (!config) {
        return {
          seat,
          label: `Seat ${seat + 1}`,
          role: 'human' as const,
          stack: 0,
          betSize: 0,
          holeCards: null,
          isActive: false,
          isToAct: false,
          isButton: false,
        };
      }

      const seatState = this.table.seats()[seat];
      const rawCards = holeCards[seat] ?? null;
      let displayCards: string[] | null = null;
      if (rawCards) {
        if (revealAllCards || seat === HUMAN_SEAT || !handInProgress) {
          displayCards = cardsToShort(rawCards);
        } else {
          displayCards = ['back', 'back'];
        }
      }

      return {
        seat,
        label: config.label,
        role: config.role,
        stack: seatState?.stack ?? 0,
        betSize: seatState?.betSize ?? 0,
        holeCards: displayCards,
        isActive: seatState !== null,
        isToAct: seat === playerToAct,
        isButton: seat === button,
      };
    });

    const legal = handInProgress && this.table.isBettingRoundInProgress()
      ? this.table.legalActions()
      : { actions: [] as Action[] };

    return {
      handInProgress,
      street,
      communityCards: handInProgress ? cardsToShort(this.table.communityCards()) : [],
      seats,
      pots: handInProgress ? this.table.pots() : [],
      humanToAct: playerToAct === HUMAN_SEAT,
      legalActions: legal.actions,
      chipRange: legal.chipRange,
      winners: handInProgress ? null : this.getWinners(),
    };
  }

  recordCoachAdvice(summary: string): void {
    this.recordAgentTrace(
      'coach',
      HUMAN_SEAT,
      `Built advice from the human cards and public board: ${summary}`,
      this.getScopedView('coach'),
    );
  }

  act(
    seat: number,
    action: Action,
    betSize?: number,
    rationale?: string,
    thinkingProcess?: string[],
  ): void {
    const street = this.table.roundOfBetting() as Street;
    const label = SEAT_CONFIG[seat]?.label ?? `Seat ${seat + 1}`;

    this.actionLog.push({
      seat,
      player: label,
      action,
      betSize,
      street,
      timestamp: Date.now(),
      rationale,
      thinkingProcess: thinkingProcess ?? (rationale ? [rationale] : undefined),
    });

    this.table.actionTaken(action, betSize);
  }

  async advanceUntilHumanOrComplete(
    decideAI?: AIDecisionProvider,
  ): Promise<AdvanceResult> {
    while (this.table.isHandInProgress()) {
      while (this.table.isBettingRoundInProgress()) {
        const seat = this.table.playerToAct();
        if (seat === HUMAN_SEAT) {
          return 'human_turn';
        }

        // Once the human is out of the hand, fast-forward the AI-only
        // playout with local heuristics instead of paced LLM turns.
        const humanInHand = this.table.handPlayers()[HUMAN_SEAT] !== null;

        if (!this.fastMode && humanInHand) {
          await dealerTimers.delay(dealerTimers.randomAgentDelay());
        }

        const view = this.getScopedView(this.agentIdForSeat(seat), seat);
        const memory = this.memory.getSnapshot(this.agentIdForSeat(seat));
        const fallback = pickAIAction(seat, view, memory);
        const { decision, trace } = decideAI && humanInHand
          ? await decideAI(seat, view, memory, fallback)
          : fallback;
      this.decisionTraces.push(trace);
      this.memory.recordDecision(trace);
      this.act(
        seat,
        decision.action,
        decision.betSize,
        decision.rationale,
        decision.thinkingProcess,
      );
      }

      this.table.endBettingRound();

      if (this.table.areBettingRoundsCompleted()) {
        this.finishHand(this.table.areBettingRoundsCompleted());
        return 'hand_complete';
      }

      if (this.table.numActivePlayers() <= 1) {
        this.finishHand(false);
        return 'hand_complete';
      }
    }

    return 'waiting';
  }

  private finishHand(runShowdown: boolean): void {
    const snapshot = this.captureTableView();
    this.lastPots = this.table.isHandInProgress() ? this.table.pots() : this.lastPots;
    if (runShowdown) {
      endHand(this.table);
    }
    this.applyCurrentStacks(snapshot);
    const winners = this.getWinners();
    snapshot.winners = winners;
    snapshot.handInProgress = false;
    snapshot.humanToAct = false;
    snapshot.legalActions = [];
    this.completedHandView = snapshot;
    this.updateRecords(winners);
    this.recordAgentTrace(
      'report',
      undefined,
      'Prepared to review complete history, all revealed cards, and every stored decision trace.',
      snapshot,
    );
  }

  finalizeHandReport(): HandReport {
    const view = this.getView(true);
    this.lastHandReport = buildHandReport(
      this.actionLog,
      view,
      this.decisionTraces,
      this.getPlayerRecords(),
    );
    return this.lastHandReport;
  }

  private captureTableView(): TableView {
    const handInProgress = this.table.isHandInProgress();
    const street = handInProgress ? this.table.roundOfBetting() : null;
    const button = handInProgress ? this.table.button() : -1;
    const holeCards = handInProgress ? this.table.holeCards() : [];

    const seats: SeatView[] = Array.from({ length: TABLE_SEATS }, (_, seat) => {
      const config = SEAT_CONFIG[seat];
      if (!config) {
        return {
          seat,
          label: `Seat ${seat + 1}`,
          role: 'human' as const,
          stack: 0,
          betSize: 0,
          holeCards: null,
          isActive: false,
          isToAct: false,
          isButton: false,
        };
      }

      const seatState = this.table.seats()[seat];
      const rawCards = holeCards[seat] ?? null;

      return {
        seat,
        label: config.label,
        role: config.role,
        stack: seatState?.stack ?? 0,
        betSize: seatState?.betSize ?? 0,
        holeCards: rawCards ? cardsToShort(rawCards) : null,
        isActive: seatState !== null,
        isToAct: false,
        isButton: seat === button,
      };
    });

    return {
      handInProgress: true,
      street,
      communityCards: handInProgress ? cardsToShort(this.table.communityCards()) : [],
      seats,
      pots: handInProgress ? this.table.pots() : [...this.lastPots],
      humanToAct: false,
      legalActions: [],
      winners: null,
    };
  }

  private hasShowdownCards(): boolean {
    if (!this.table.isHandInProgress()) return false;
    return this.table.holeCards().some((cards: unknown) => cards !== null);
  }

  private getWinners(): WinnerView[] | null {
    const handInProgress = this.table.isHandInProgress();
    const winners = handInProgress ? [] : this.table.winners();
    if (!winners.length) {
      const pots = handInProgress ? this.table.pots() : this.lastPots;
      if (pots.length === 1 && pots[0].eligiblePlayers.length === 1) {
        const seat = pots[0].eligiblePlayers[0];
        return [
          {
            seat,
            label: SEAT_CONFIG[seat]?.label ?? `Seat ${seat + 1}`,
            handName: 'Won uncontested',
            cards: [],
          },
        ];
      }
      return null;
    }

    const result: WinnerView[] = [];
    for (const potWinners of winners) {
      for (const [seat, hand] of potWinners) {
        result.push({
          seat,
          label: SEAT_CONFIG[seat]?.label ?? `Seat ${seat + 1}`,
          handName: HAND_RANKING_NAMES[hand.ranking] ?? 'Winner',
          cards: cardsToShort(hand.cards),
        });
      }
    }
    return result;
  }

  private getScopedView(agentId: AgentId, revealSeat?: number): TableView {
    const reveal =
      agentId === 'coach'
        ? HUMAN_SEAT
        : agentId === 'ai_aggressive' || agentId === 'ai_conservative'
          ? revealSeat
          : undefined;

    return this.buildViewForSeat(reveal);
  }

  private buildViewForSeat(revealSeat?: number): TableView {
    if (!this.table.isHandInProgress() && this.completedHandView) {
      return {
        ...this.completedHandView,
        seats: this.completedHandView.seats.map((seat) => ({
          ...seat,
          holeCards: seat.seat === revealSeat ? seat.holeCards : seat.holeCards ? ['back', 'back'] : null,
        })),
      };
    }

    const view = this.getView(false);
    return {
      ...view,
      seats: view.seats.map((seat) => {
        if (!seat.holeCards || seat.seat === revealSeat) {
          return seat;
        }
        return { ...seat, holeCards: ['back', 'back'] };
      }),
    };
  }

  private recordAgentTrace(
    agentId: AgentId,
    seat: number | undefined,
    rationale: string,
    view: TableView,
  ): void {
    const memory = this.memory.getSnapshot(agentId);
    const visibleCards = view.seats.flatMap((item) =>
      item.holeCards?.filter((card) => card !== 'back') ?? [],
    );
    const trace: AgentDecisionTrace = {
      id: `${agentId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      agentId,
      label: memory.label,
      seat,
      street: view.street,
      observation: [
        `Board: ${view.communityCards.length ? view.communityCards.join(' ') : 'none'}`,
        `Public pot total: $${view.pots.reduce((sum, pot) => sum + pot.size, 0)}`,
      ],
      shortTerm: memory.shortTerm,
      rationale,
      thinkingProcess: [
        'Collected the role-scoped visible state.',
        'Applied the agent responsibility and memory profile.',
        'Recorded a public reasoning summary for the demo trace.',
      ],
      visibleCards: [...visibleCards, ...view.communityCards],
      timestamp: Date.now(),
    };

    this.decisionTraces.push(trace);
    this.memory.recordDecision(trace);
  }

  private agentIdForSeat(seat: number): AgentId {
    if (seat === AI_AGGRESSIVE_SEAT) return 'ai_aggressive';
    if (seat === AI_CONSERVATIVE_SEAT) return 'ai_conservative';
    return 'dealer';
  }

  private createPlayerRecord(
    seat: number,
    credits: number,
    saved?: PlayerRecord,
  ): PlayerRecord {
    const config = SEAT_CONFIG[seat];
    return {
      seat,
      label: config?.label ?? `Seat ${seat + 1}`,
      role: config?.role ?? 'human',
      startingCredit: saved?.startingCredit ?? STARTING_STACK,
      credits,
      handsPlayed: saved?.handsPlayed ?? 0,
      wins: saved?.wins ?? 0,
      voluntaryActions: saved?.voluntaryActions ?? 0,
      aggressiveActions: saved?.aggressiveActions ?? 0,
      folds: saved?.folds ?? 0,
      net: credits - (saved?.startingCredit ?? STARTING_STACK),
      recentResults: saved?.recentResults ? [...saved.recentResults] : [],
    };
  }

  private applyCurrentStacks(view: TableView): void {
    const seats = this.table.seats();
    view.seats = view.seats.map((seat) => ({
      ...seat,
      stack: seats[seat.seat]?.stack ?? seat.stack,
    }));
  }

  private updateRecords(winners: WinnerView[] | null): void {
    const winnerSeats = new Set((winners ?? []).map((winner) => winner.seat));
    const seats = this.table.seats();

    for (const seat of ACTIVE_SEATS) {
      const record = this.records.get(seat);
      if (!record) continue;

      const previousCredits = record.credits;
      const credits = seats[seat]?.stack ?? previousCredits;
      const actions = this.actionLog.filter((entry) => entry.seat === seat);
      const aggressiveActions = actions.filter(
        (entry) => entry.action === 'bet' || entry.action === 'raise',
      ).length;
      const folds = actions.filter((entry) => entry.action === 'fold').length;
      const voluntaryActions = actions.filter((entry) => entry.action !== 'check').length;

      this.records.set(seat, {
        ...record,
        credits,
        handsPlayed: record.handsPlayed + 1,
        wins: record.wins + (winnerSeats.has(seat) ? 1 : 0),
        voluntaryActions: record.voluntaryActions + voluntaryActions,
        aggressiveActions: record.aggressiveActions + aggressiveActions,
        folds: record.folds + folds,
        net: credits - record.startingCredit,
        recentResults: [...record.recentResults, credits - previousCredits].slice(-12),
      });
    }
  }
}
