import * as dotenv from "dotenv";

// Load .env before running the app or importing any other files
dotenv.config();

import { Signer } from "ecpair";
import { bitcoinjs } from "./bitcoinjs-wrapper";
import { buildScripts, constructP2TR } from "./builder";
import { regtestUtils } from "./_regtest";
import { liftX } from "./utils/schnorr-utils";
import { constructHashlockSpend, finalizeHashlockSpend } from "./vault-helpers";
import { Psbt } from "bitcoinjs-lib";

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
  secretBytes: Buffer,
  faucetAmount: number
): Promise<any> {
  const hashedSecret = bitcoinjs.crypto.hash160(secretBytes);

  const { scriptTree } = buildScripts(
    userKeypair.publicKey,
    signerKeypair.publicKey,
    hashedSecret
  );
  const { output } = constructP2TR(INVALID_ADDRESS, scriptTree, NETWORK);
  // amount from faucet
  const amount = faucetAmount; //42e4;
  // get faucet
  const utxo = await regtestUtils.faucetComplex(output!, amount);
  return { hashedSecret, unspentTxId: utxo.txId };
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
  signerKeypair: Signer,
  secretWord: Buffer,
  hashedSecret: Buffer,
  faucetAmount: number,
  unspentTxId: string,
  receiverAddress: string
): Promise<any> {
  const sendAmount = faucetAmount - 1e4;

  const psbtHex = constructHashlockSpend(
    {
      userPubKey,
      signerPubKey,
      hashedSecret,
    },
    [
      {
        txHash: unspentTxId,
        idx: 0,
        value: faucetAmount,
      },
    ],
    [
      {
        recipient: receiverAddress,
        amount: sendAmount,
      },
    ]
  );

  const psbt = Psbt.fromHex(psbtHex, {
    network: NETWORK,
  });
  psbt.signAllInputs(signerKeypair);

  const { txHash, txHex } = finalizeHashlockSpend(psbt, secretWord);

  await regtestUtils.broadcast(txHex);
  await regtestUtils.verify({
    txId: txHash,
    address: receiverAddress!,
    vout: 0,
    value: sendAmount,
  });
}
