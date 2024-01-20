/**
 * This is the file that defines, builds, and interfaces with vaults.
 *
 * @see {@link README.md} for more information around the intended usecase for vaults.
 */

import { witnessStackToScriptWitness } from "./utils/witness-utils";
import { bitcoinjs } from "./bitcoinjs-wrapper";
import { liftX } from "./utils/schnorr-utils";
import { RawInput, RawOutput, VaultParams } from "./types";
import { PsbtInput } from "bip174/src/lib/interfaces";
import { Network, Payment, Psbt } from "bitcoinjs-lib";
import { Taptree } from "bitcoinjs-lib/src/types";
import { toXOnly } from "./utils/taproot-utils";

// Nothing Up My Sleeve (NUMS) address is used because vaults are intended to be used without an internal pubkey
// https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#:~:text=H%20%3D%20lift_x(0x50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0)
const NUMS_ADDRESS = liftX(
  Buffer.from(
    "50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0",
    "hex"
  )
);

/**
 * Construct (or reconstruct) a vault P2TR with the given params
 *
 * @param script the optional script to use when initializing a payment
 */
export function buildVaultP2TR(
  vaultParams: VaultParams,
  network: Network,
  script?: Buffer
): Payment {
  // unpack vault params
  const { userPubKey, signerPubKey, hashedSecret } = vaultParams;

  // build scripts
  const { scriptTree } = buildScripts(userPubKey, signerPubKey, hashedSecret);

  return bitcoinjs.payments.p2tr({
    internalPubkey: toXOnly(NUMS_ADDRESS),
    scriptTree,
    network,
    redeem: script && {
      output: script,
      redeemVersion: 192,
    },
  });
}

/**
 * Initialize unsigned, unfinalized PSBT
 * @param vaultParams
 * @param signerSig
 * @param inputs
 * @param outputs
 * @returns
 */
export function buildVaultPSBT(
  vaultParams: VaultParams,
  inputs: RawInput[],
  outputs: RawOutput[],
  spendScript: "multisig" | "hashlock",
  network: Network
): string {
  const { userPubKey, signerPubKey, hashedSecret } = vaultParams;

  // reconstruct scripts
  const { multisigScript, hashlockScript } = buildScripts(
    userPubKey,
    signerPubKey,
    hashedSecret
  );

  // choose correct script
  const script = spendScript === "multisig" ? multisigScript : hashlockScript;

  const { output, witness, redeem } = buildVaultP2TR(
    vaultParams,
    network,
    script
  );

  const psbt = new bitcoinjs.Psbt({ network });

  for (const input of inputs) {
    psbt.addInput({
      hash: input.txHash,
      index: input.idx,
      witnessUtxo: { value: input.value, script: output! },
      tapLeafScript: [
        {
          leafVersion: redeem!.redeemVersion!,
          script,
          controlBlock: witness![witness!.length - 1],
        },
      ],
    });
  }

  for (const output of outputs) {
    psbt.addOutput({ value: output.amount, address: output.recipient });
  }

  return psbt.toHex();
}

/**
 * Finalize hashlock spend with script args after signing inputs
 * @param psbt
 * @param secretBytes
 */
export function finalizeVaultPSBT(
  psbt: Psbt,
  spendScript: "multisig" | "hashlock",
  secretBytes?: Buffer
): { txHex: string; txHash: string } {
  // pass secret answer for hashlock
  if (spendScript === "hashlock") {
    if (!secretBytes) {
      throw new Error("Secret bytes are required for hashlock spend");
    }

    const customFinalizer = (_idx: number, input: PsbtInput) => {
      const scriptSolution = [input.tapScriptSig![0].signature, secretBytes];

      const witness = scriptSolution
        .concat(input.tapLeafScript![0].script)
        .concat(input.tapLeafScript![0].controlBlock);

      return {
        finalScriptWitness: witnessStackToScriptWitness(witness),
      };
    };

    psbt.txInputs.forEach((_input, idx) => {
      psbt.finalizeInput(idx, customFinalizer);
    });
  } else {
    // for multisig script we don't need to do anything special
    psbt.finalizeAllInputs();
  }

  const tx = psbt.extractTransaction();
  return { txHex: tx.toHex(), txHash: tx.getId() };
}

function buildScripts(
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
