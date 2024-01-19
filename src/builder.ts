import { Network } from "bitcoinjs-lib";
import { Taptree } from "bitcoinjs-lib/src/types";
import { bitcoinjs } from "./bitcoinjs-wrapper";
import { toXOnly } from "./utils/taproot-utils";

export function constructP2TR(
  internalPubKey: Buffer,
  scriptTree: Taptree,
  network: Network,
  redeem?: bitcoinjs.payments.Payment
) {
  return bitcoinjs.payments.p2tr({
    internalPubkey: toXOnly(internalPubKey),
    scriptTree,
    network,
    redeem,
  });
}

export function buildScripts(
  userPubKey: Buffer,
  signerPubKey: Buffer,
  hashedSecret: Buffer
): {
  multisigScript: Buffer;
  hashlockScript: Buffer;
  scriptTree: Taptree;
} {
  const multisigScript = bitcoinjs.script.fromASM(
    `${toXOnly(userPubKey).toString("hex")} OP_CHECKSIG ${toXOnly(
      signerPubKey
    ).toString("hex")} OP_CHECKSIGADD OP_2 OP_EQUAL`
  );

  const hashlockScript = bitcoinjs.script.fromASM(
    `OP_HASH160 ${hashedSecret.toString("hex")} OP_EQUALVERIFY ${toXOnly(
      signerPubKey
    ).toString("hex")} OP_CHECKSIG`
  );
  // Construct MAST
  const scriptTree: Taptree = [
    {
      output: multisigScript,
    },
    {
      output: hashlockScript,
    },
  ];

  return {
    multisigScript,
    hashlockScript,
    scriptTree,
  };
}
