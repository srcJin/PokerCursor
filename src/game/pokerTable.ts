import PokerImport from 'poker-ts/dist/facade/poker.js';

function resolvePokerConstructor(mod: unknown): new (
  forcedBets: { ante?: number; bigBlind: number; smallBlind: number },
  numSeats?: number,
) => PokerImport {
  if (typeof mod === 'function') {
    return mod as new (
      forcedBets: { ante?: number; bigBlind: number; smallBlind: number },
      numSeats?: number,
    ) => PokerImport;
  }

  const withDefault = mod as { default?: unknown };
  if (typeof withDefault.default === 'function') {
    return withDefault.default as new (
      forcedBets: { ante?: number; bigBlind: number; smallBlind: number },
      numSeats?: number,
    ) => PokerImport;
  }

  throw new Error('Failed to load poker-ts Table constructor');
}

const PokerTable = resolvePokerConstructor(PokerImport);

export type PokerTableInstance = InstanceType<typeof PokerTable>;

export default PokerTable;
