import { bitcoinjs } from "./bitcoinjs-wrapper";

export function buildScripts(
  xOnlyUserPubKey: Buffer,
  xOnlySignerPubKey: Buffer,
  secretHash: Buffer
): {
  multisigScript: Buffer;
  hashlockScript: Buffer;
} {
  return {
    multisigScript: bitcoinjs.script.fromASM(
      `${xOnlyUserPubKey.toString(
        "hex"
      )} OP_CHECKSIG ${xOnlySignerPubKey.toString(
        "hex"
      )} OP_CHECKSIGADD ${Buffer.from("2").toString("hex")} OP_EQUAL`
    ),
    hashlockScript: bitcoinjs.script.fromASM(
      `OP_HASH160 ${secretHash.toString(
        "hex"
      )} OP_EQUALVERIFY ${xOnlySignerPubKey.toString("hex")} OP_CHECKSIG`
    ),
  };
}
