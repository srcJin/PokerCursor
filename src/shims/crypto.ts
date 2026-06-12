import nodeCrypto from 'crypto-browserify';

type CryptoWithRandomInt = typeof nodeCrypto & {
  randomInt: (min: number, max: number) => number;
};

const crypto = nodeCrypto as CryptoWithRandomInt;

if (typeof crypto.randomInt !== 'function') {
  crypto.randomInt = (min: number, max: number) => {
    const range = max - min;
    if (range <= 0) return min;
    const bytes = crypto.randomBytes(4);
    return min + (bytes.readUInt32BE(0) % range);
  };
}

export default crypto;
