import * as ecpair from "ecpair";
import * as tinysecp from "tiny-secp256k1";

// init
const ecpairFactory = ecpair.ECPairFactory(tinysecp);

export function randomKeypair(opts: any): ecpair.ECPairInterface {
  return ecpairFactory.makeRandom(opts);
}

export function loadKeypair(
  privateKey: Buffer,
  opts: any
): ecpair.ECPairInterface {
  return ecpairFactory.fromPrivateKey(privateKey, opts);
}

export function toXOnly(pubKey: Buffer): Buffer {
  return pubKey.length === 32 ? pubKey : pubKey.subarray(1, 33);
}
