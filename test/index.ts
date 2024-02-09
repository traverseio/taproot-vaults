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
import { VaultParams } from "../src/types";

const NETWORK = regtestUtils.network;

export async function setupTaprootAndFaucet(
  vaultParams: VaultParams,
  faucetAmount: number
): Promise<any> {
  const { address, output } = buildVaultP2TR(vaultParams, NETWORK);

  // request from faucet
  const utxo = await regtestUtils.faucetComplex(output!, faucetAmount);

  return { address, unspentTxId: utxo.txId };
}

export async function spendMultisig(
  vaultParams: VaultParams,
  userKeypair: Signer | null,
  signerKeypair: Signer | null,
  faucetAmount: number,
  unspentTxId: string,
  receiverAddress: string
): Promise<any> {
  const sendAmount = faucetAmount - 1e4;

  const psbtHex = buildVaultPSBT(
    vaultParams,
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
  vaultParams: VaultParams,
  signerKeypair: Signer | null,
  secretWord: Buffer,
  faucetAmount: number,
  unspentTxId: string,
  receiverAddress: string
): Promise<any> {
  const sendAmount = faucetAmount - 1e4;

  const psbtHex = buildVaultPSBT(
    vaultParams,
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
