import type { PokerTableInstance } from '../game/pokerTable';

/** Dealer agent: manages hand lifecycle and button rotation. */
export function startNewHand(table: PokerTableInstance): void {
  if (table.isHandInProgress()) {
    return;
  }
  table.startHand();
}

export function endHand(table: PokerTableInstance): void {
  if (!table.isHandInProgress()) {
    return;
  }

  if (table.areBettingRoundsCompleted()) {
    table.showdown();
  }
}

export function getDealerSeat(table: PokerTableInstance): number {
  return table.button();
}

export function formatDealerMessage(message: string): string {
  return `[DEALER]: ${message}`;
}

export interface TimerHandle {
  clear: () => void;
}

const schedule = globalThis.setTimeout.bind(globalThis);
const cancel = globalThis.clearTimeout.bind(globalThis);

/** Turn timers used by the table UI and AI pacing. */
export class DealerTimers {
  startPlayerTimer(onExpire: () => void, onWarning: () => void): TimerHandle {
    const warningId = schedule(onWarning, 40_000);
    const expireId = schedule(onExpire, 60_000);

    return {
      clear: () => {
        cancel(warningId);
        cancel(expireId);
      },
    };
  }

  startAgentTimer(callback: () => void): TimerHandle {
    const delay = 3_000 + Math.floor(Math.random() * 27_001);
    const timerId = schedule(callback, delay);

    return {
      clear: () => {
        cancel(timerId);
      },
    };
  }

  delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      schedule(resolve, ms);
    });
  }

  randomAgentDelay(): number {
    return 3_000 + Math.floor(Math.random() * 27_001);
  }
}

export const dealerTimers = new DealerTimers();
