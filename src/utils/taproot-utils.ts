import { Network } from "bitcoinjs-lib";
import * as ecpair from "ecpair";
import { ecpairFactory } from "../wrappers/ecpair-wrapper";

export function randomKeyPair(network: Network): ecpair.ECPairInterface {
  return ecpairFactory.makeRandom({ network });
}

export function loadKeyPair(
  privateKey: Buffer,
  network: Network
): ecpair.ECPairInterface {
  return ecpairFactory.fromPrivateKey(privateKey, { network });
}

export function toXOnly(pubKey: Buffer): Buffer {
  return pubKey.length === 32 ? pubKey : pubKey.subarray(1, 33);
}
