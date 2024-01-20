import { Signer } from "ecpair";
import { witnessStackToScriptWitness } from "./utils/witness-utils";
import { bitcoinjs } from "./bitcoinjs-wrapper";
import { buildScripts, constructP2TR } from "./builder";
import { regtestUtils } from "./_regtest";
import { liftX } from "./utils/schnorr-utils";
import { RawInput, RawOutput, VaultParams } from "./types";
import { PsbtInput } from "bip174/src/lib/interfaces";
import { Psbt } from "bitcoinjs-lib";

const NETWORK = regtestUtils.network;
// https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#:~:text=H%20%3D%20lift_x(0x50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0)
const INVALID_ADDRESS = liftX(
  Buffer.from(
    "50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0",
    "hex"
  )
);

export async function constructVaultP2TR(
  userPubKey: Buffer,
  signerPubKey: Buffer,
  hashedSecret: Buffer
): Promise<{
  address: string | undefined;
  output: Buffer | undefined;
}> {
  const { scriptTree } = buildScripts(userPubKey, signerPubKey, hashedSecret);
  const { address, output } = constructP2TR(
    INVALID_ADDRESS,
    scriptTree,
    NETWORK
  );
  return { address, output };
}

export async function spendMultisig(
  userPubKey: Buffer,
  signerPubKey: Buffer,
  userKeypair: Signer | null,
  signerKeypair: Signer | null,
  hashedSecret: Buffer,
  faucetAmount: number,
  unspentTxId: string,
  receiverAddress: string
): Promise<any> {
  const { multisigScript, scriptTree } = buildScripts(
    userPubKey,
    signerPubKey,
    hashedSecret
  );

  const redeem = {
    output: multisigScript,
    redeemVersion: 192,
  };

  const { output, address, witness } = constructP2TR(
    INVALID_ADDRESS,
    scriptTree,
    NETWORK,
    redeem
  );

  const psbt = new bitcoinjs.Psbt({ network: NETWORK });
  psbt.addInput({
    hash: unspentTxId,
    index: 0,
    witnessUtxo: { value: faucetAmount, script: output! },
    tapLeafScript: [
      {
        leafVersion: redeem.redeemVersion,
        script: redeem.output,
        controlBlock: witness![witness!.length - 1],
      },
    ],
  });

  const sendAmount = faucetAmount - 1e4;
  psbt.addOutput({
    value: sendAmount,
    address: receiverAddress!,
  });

  // random order for signers
  if (userKeypair) psbt.signInput(0, userKeypair);
  if (signerKeypair) psbt.signInput(0, signerKeypair);

  psbt.finalizeInput(0);
  const tx = psbt.extractTransaction();
  const rawTx = tx.toBuffer();
  const hex = rawTx.toString("hex");

  await regtestUtils.broadcast(hex);
  await regtestUtils.verify({
    txId: tx.getId(),
    address: receiverAddress!,
    vout: 0,
    value: sendAmount,
  });
}

/**
 * Initialize unsigned hashlock spend PSBT
 * @param vaultParams
 * @param signerSig
 * @param inputs
 * @param outputs
 * @returns
 */
export function constructHashlockSpend(
  vaultParams: VaultParams,
  inputs: RawInput[],
  outputs: RawOutput[]
): string {
  const { userPubKey, signerPubKey, hashedSecret } = vaultParams;

  // reconstruct scripts
  const { hashlockScript, scriptTree } = buildScripts(
    userPubKey,
    signerPubKey,
    hashedSecret
  );

  //
  const { output, witness, redeem } = constructP2TR(
    INVALID_ADDRESS,
    scriptTree,
    NETWORK,
    {
      output: hashlockScript,
      redeemVersion: 192,
    }
  );

  const psbt = new bitcoinjs.Psbt({ network: NETWORK });

  for (const input of inputs) {
    psbt.addInput({
      hash: input.txHash,
      index: input.idx,
      witnessUtxo: { value: input.value, script: output! },
      tapLeafScript: [
        {
          leafVersion: redeem!.redeemVersion!,
          script: hashlockScript,
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
export function finalizeHashlockSpend(
  psbt: Psbt,
  secretBytes: Buffer
): { txHex: string; txHash: string } {
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

  const tx = psbt.extractTransaction();
  return { txHex: tx.toHex(), txHash: tx.getId() };
}
