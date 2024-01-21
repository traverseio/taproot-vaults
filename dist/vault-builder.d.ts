/**
 * This is the file that defines, builds, and interfaces with vaults.
 *
 * @see {@link README.md} for more information around the intended usecase for vaults.
 */
/// <reference types="node" />
import { RawInput, RawOutput, VaultParams } from "./types";
import { Network, Payment, Psbt } from "bitcoinjs-lib";
/**
 * Construct (or reconstruct) a vault P2TR with the given params
 *
 * @param script the optional script to use when initializing a payment
 */
export declare function buildVaultP2TR(vaultParams: VaultParams, network: Network, script?: Buffer): Payment;
/**
 * Initialize unsigned, unfinalized PSBT
 * @param vaultParams
 * @param signerSig
 * @param inputs
 * @param outputs
 * @returns
 */
export declare function buildVaultPSBT(vaultParams: VaultParams, inputs: RawInput[], outputs: RawOutput[], spendScript: "multisig" | "hashlock", network: Network): string;
/**
 * Finalize hashlock spend with script args after signing inputs
 * @param psbt
 * @param secretBytes
 */
export declare function finalizeVaultPSBT(psbt: Psbt, spendScript: "multisig" | "hashlock", secretBytes?: Buffer): {
    txHex: string;
    txHash: string;
};
