import { Signer } from "ecpair";
import { bitcoinjs } from "../src/wrappers/bitcoinjs-wrapper";
import { regtestUtils } from "./regtest";
import {
  buildVaultP2TR,
  buildVaultPSBT,
  finalizeVaultPSBT,
} from "../src/vault-builder";
import { Psbt } from "bitcoinjs-lib";
import { randomKeyPair as randomKP } from "../src/utils/taproot-utils";

const NETWORK = regtestUtils.network;

export async function setupTaprootAndFaucet(
  userKeypair: Signer,
  signerKeypair: Signer,
  secretBytes: Buffer,
  faucetAmount: number
): Promise<any> {
  const hashedSecret = bitcoinjs.crypto.hash160(secretBytes);

  const { output } = buildVaultP2TR(
    {
      userPubKey: userKeypair.publicKey,
      signerPubKey: signerKeypair.publicKey,
      hashedSecret,
    },
    NETWORK
  );

  // request from faucet
  const utxo = await regtestUtils.faucetComplex(output!, faucetAmount);

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
  const sendAmount = faucetAmount - 1e4;

  const psbtHex = buildVaultPSBT(
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
    ],
    "multisig",
    NETWORK
  );

  const psbt = Psbt.fromHex(psbtHex, {
    network: NETWORK,
  });

  if (userKeypair) psbt.signAllInputs(userKeypair);
  if (signerKeypair) psbt.signAllInputs(signerKeypair);

  const { txHash, txHex } = finalizeVaultPSBT(psbt, "multisig");

  await regtestUtils.broadcast(txHex);
  await regtestUtils.verify({
    txId: txHash,
    address: receiverAddress!,
    vout: 0,
    value: sendAmount,
  });
}

export async function spendHashlock(
  userPubKey: Buffer,
  signerPubKey: Buffer,
  signerKeypair: Signer | null,
  secretWord: Buffer,
  hashedSecret: Buffer,
  faucetAmount: number,
  unspentTxId: string,
  receiverAddress: string
): Promise<any> {
  const sendAmount = faucetAmount - 1e4;

  const psbtHex = buildVaultPSBT(
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
    ],
    "hashlock",
    NETWORK
  );

  const psbt = Psbt.fromHex(psbtHex, {
    network: NETWORK,
  });

  if (signerKeypair) psbt.signAllInputs(signerKeypair);

  const { txHash, txHex } = finalizeVaultPSBT(psbt, "hashlock", secretWord);

  await regtestUtils.broadcast(txHex);
  await regtestUtils.verify({
    txId: txHash,
    address: receiverAddress!,
    vout: 0,
    value: sendAmount,
  });
}

export function randomKeyPair(): Signer {
  return randomKP(NETWORK);
}
