import type { Action } from '../types/poker';
import PokerTable from './pokerTable';

import { pickAIAction } from '../agents/aiPlayer';
import { endHand, startNewHand } from '../agents/dealer';
import { buildHandReport } from '../agents/report';
import type {
  ActionLogEntry,
  HandReport,
  SeatView,
  Street,
  TableView,
  WinnerView,
} from '../types/game';
import { cardsToShort } from './cards';
import {
  ACTIVE_SEATS,
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

import type { PokerTableInstance } from './pokerTable';

export class GameSession {
  private table: PokerTableInstance;
  private actionLog: ActionLogEntry[] = [];
  private lastHandReport: HandReport | null = null;
  private completedHandView: TableView | null = null;

  constructor() {
    this.table = new PokerTable({ smallBlind: 1, bigBlind: 2 }, TABLE_SEATS);
    for (const seat of ACTIVE_SEATS) {
      this.table.sitDown(seat, STARTING_STACK);
    }
  }

  getActionLog(): ActionLogEntry[] {
    return [...this.actionLog];
  }

  getLastHandReport(): HandReport | null {
    return this.lastHandReport;
  }

  startHand(): void {
    this.actionLog = [];
    this.lastHandReport = null;
    this.completedHandView = null;
    startNewHand(this.table);
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

  act(seat: number, action: Action, betSize?: number): void {
    const street = this.table.roundOfBetting() as Street;
    const label = SEAT_CONFIG[seat]?.label ?? `Seat ${seat + 1}`;

    this.actionLog.push({
      seat,
      player: label,
      action,
      betSize,
      street,
      timestamp: Date.now(),
    });

    this.table.actionTaken(action, betSize);
  }

  advanceUntilHumanOrComplete(): AdvanceResult {
    while (this.table.isHandInProgress()) {
      while (this.table.isBettingRoundInProgress()) {
        const seat = this.table.playerToAct();
        if (seat === HUMAN_SEAT) {
          return 'human_turn';
        }

        const decision = pickAIAction(seat, this.table);
        this.act(seat, decision.action, decision.betSize);
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
    if (runShowdown) {
      endHand(this.table);
    }
    snapshot.winners = this.getWinners();
    snapshot.handInProgress = false;
    snapshot.humanToAct = false;
    snapshot.legalActions = [];
    this.completedHandView = snapshot;
  }

  finalizeHandReport(): HandReport {
    const view = this.getView(true);
    this.lastHandReport = buildHandReport(this.actionLog, view);
    return this.lastHandReport;
  }

  private captureTableView(): TableView {
    const handInProgress = this.table.isHandInProgress();
    const street = handInProgress ? this.table.roundOfBetting() : null;
    const button = handInProgress ? this.table.button() : -1;
    const holeCards = this.table.holeCards();

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
      communityCards: cardsToShort(this.table.communityCards()),
      seats,
      pots: this.table.pots(),
      humanToAct: false,
      legalActions: [],
      winners: null,
    };
  }

  private hasShowdownCards(): boolean {
    return this.table.holeCards().some((cards: unknown) => cards !== null);
  }

  private getWinners(): WinnerView[] | null {
    const winners = this.table.winners();
    if (!winners.length) {
      const pots = this.table.pots();
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
}
