import * as dotenv from "dotenv";

// Load .env before running the app or importing any other files
dotenv.config();

import { Signer } from "ecpair";
import { witnessStackToScriptWitness } from "./utils/witness-utils";
import { bitcoinjs } from "./bitcoinjs-wrapper";
import { buildScripts, constructP2TR } from "./builder";
import { regtestUtils } from "./_regtest";
import { liftX } from "./utils/schnorr-utils";

const NETWORK = regtestUtils.network;
// https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#:~:text=H%20%3D%20lift_x(0x50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0)
const INVALID_ADDRESS = liftX(
  Buffer.from(
    "50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0",
    "hex"
  )
);

export async function setupTaprootAndFaucet(
  userKeypair: Signer,
  signerKeypair: Signer,
  secretWord: string,
  faucetAmount: number
): Promise<any> {
  const secret_answer = Buffer.from(secretWord);
  const hash = bitcoinjs.crypto.hash160(secret_answer);

  const { scriptTree } = buildScripts(
    userKeypair.publicKey,
    signerKeypair.publicKey,
    hash
  );
  const { output } = constructP2TR(INVALID_ADDRESS, scriptTree, NETWORK);
  // amount from faucet
  const amount = faucetAmount; //42e4;
  // get faucet
  const utxo = await regtestUtils.faucetComplex(output!, amount);
  return { hashedSecret: hash, unspentTxId: utxo.txId };
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
  });
  psbt.updateInput(0, {
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

export async function spendHashlock(
  userPubKey: Buffer,
  signerPubKey: Buffer,
  signerKeypair: Signer | null,
  secretWord: string | null,
  hashedSecret: Buffer,
  faucetAmount: number,
  unspentTxId: string,
  receiverAddress: string
): Promise<any> {
  const { hashlockScript, scriptTree } = buildScripts(
    userPubKey,
    signerPubKey,
    hashedSecret
  );
  const redeem = {
    output: hashlockScript,
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
  });
  const tapLeafScript = {
    leafVersion: redeem.redeemVersion,
    script: redeem.output,
    controlBlock: witness![witness!.length - 1],
  };
  psbt.updateInput(0, {
    tapLeafScript: [tapLeafScript],
  });

  const sendAmount = faucetAmount - 1e4;
  psbt.addOutput({ value: sendAmount, address: receiverAddress! });

  if (signerKeypair) psbt.signInput(0, signerKeypair);
  if (secretWord) {
    const customFinalizer = (_inputIndex: number, input: any) => {
      const scriptSolution = [
        input.tapScriptSig[0].signature,
        Buffer.from(secretWord),
      ];
      const witness = scriptSolution
        .concat(tapLeafScript.script)
        .concat(tapLeafScript.controlBlock);
      return {
        finalScriptWitness: witnessStackToScriptWitness(witness),
      };
    };

    psbt.finalizeInput(0, customFinalizer);
  } else {
    psbt.finalizeInput(0);
  }
  // psbt.finalizeInput(0);
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
