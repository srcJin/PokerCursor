/// <reference types="vite/client" />

declare module 'crypto-browserify' {
  import type { Buffer } from 'buffer';
  const crypto: {
    randomBytes(size: number): Buffer;
    randomInt(min: number, max: number): number;
  };
  export default crypto;
}

declare module 'poker-odds-calc' {
  export class TexasHoldem {
    addPlayer(cards: string[]): this;
    setBoard(cards: string[]): this;
    calculate(): {
      getPlayers(): Array<{
        getWinsPercentageString(): string;
        getTiesPercentageString(): string;
      }>;
    };
  }
}
