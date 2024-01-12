import { Network } from "bitcoinjs-lib";
import { Taptree } from "bitcoinjs-lib/src/types";
import { bitcoinjs } from "./bitcoinjs-wrapper";

export function constructP2TR(
  internalPubkey: Buffer | undefined,
  scriptTree: Taptree,
  network: Network,
  redeem?: bitcoinjs.payments.Payment
) {
  return bitcoinjs.payments.p2tr({
    internalPubkey: internalPubkey,
    scriptTree,
    network,
    redeem,
  });
}
