import * as assert from "assert";
import BIP32Factory, { BIP32Interface } from "bip32";
import * as ecc from "tiny-secp256k1";
import { describe, it } from "mocha";
import { regtestUtils } from "../src/_regtest";
import { setupTaprootAndFaucet, spendMultisig, spendHashlock } from "../src";
import { Signer } from "bitcoinjs-lib";

const rng = require("randombytes");
const regtest = regtestUtils.network;
const bip32 = BIP32Factory(ecc);

describe("taproot integration test", () => {
  let userKeyPair: Signer;
  let signerKeyPair: Signer;
  let attackerKeyPair: Signer;
  let secretBytes: Buffer;
  let incorrectSecretBytes: Buffer;
  let unspentTxId: string;
  let faucetAmount: number;
  let hashedSecret: Buffer;

  beforeEach(async () => {
    userKeyPair = bip32.fromSeed(rng(64), regtest);
    signerKeyPair = bip32.fromSeed(rng(64), regtest);
    attackerKeyPair = bip32.fromSeed(rng(64), regtest);
    secretBytes = Buffer.from("topsecret!@#");
    incorrectSecretBytes = Buffer.from("joemama420");
    faucetAmount = 42e4;

    const setupResult = await setupTaprootAndFaucet(
      userKeyPair,
      signerKeyPair,
      secretBytes,
      faucetAmount
    );
    hashedSecret = setupResult.hashedSecret;
    unspentTxId = setupResult.unspentTxId;
  });

  it("multisig success", async () => {
    const receiverAddress =
      "bcrt1ptv7n7yr2mtjv3cy9m86shzhqragknvsxpx84ygnpmx5h2wpplmlsvuss6c";
    await spendMultisig(
      userKeyPair.publicKey,
      signerKeyPair.publicKey,
      userKeyPair,
      signerKeyPair,
      hashedSecret,
      faucetAmount,
      unspentTxId,
      receiverAddress
    );
  });

  it("multisig failure because user not signed", async () => {
    const receiverAddress =
      "bcrt1ptv7n7yr2mtjv3cy9m86shzhqragknvsxpx84ygnpmx5h2wpplmlsvuss6c";
    try {
      await spendMultisig(
        userKeyPair.publicKey,
        signerKeyPair.publicKey,
        null,
        signerKeyPair,
        hashedSecret,
        faucetAmount,
        unspentTxId,
        receiverAddress
      );
      assert.fail();
    } catch (err) {}
  });

  it("multisig failure because backend not signed", async () => {
    const receiverAddress =
      "bcrt1ptv7n7yr2mtjv3cy9m86shzhqragknvsxpx84ygnpmx5h2wpplmlsvuss6c";
    try {
      await spendMultisig(
        userKeyPair.publicKey,
        signerKeyPair.publicKey,
        userKeyPair,
        null,
        hashedSecret,
        faucetAmount,
        unspentTxId,
        receiverAddress
      );
      assert.fail();
    } catch (err) {}
  });

  it("multisig failure because user is attacker", async () => {
    const receiverAddress =
      "bcrt1ptv7n7yr2mtjv3cy9m86shzhqragknvsxpx84ygnpmx5h2wpplmlsvuss6c";
    try {
      await spendMultisig(
        userKeyPair.publicKey,
        signerKeyPair.publicKey,
        attackerKeyPair,
        signerKeyPair,
        hashedSecret,
        faucetAmount,
        unspentTxId,
        receiverAddress
      );
      assert.fail();
    } catch (err) {}
  });

  it("multisig failure because backend is attacker", async () => {
    const receiverAddress =
      "bcrt1ptv7n7yr2mtjv3cy9m86shzhqragknvsxpx84ygnpmx5h2wpplmlsvuss6c";
    try {
      await spendMultisig(
        userKeyPair.publicKey,
        signerKeyPair.publicKey,
        userKeyPair,
        attackerKeyPair,
        hashedSecret,
        faucetAmount,
        unspentTxId,
        receiverAddress
      );
      assert.fail();
    } catch (err) {}
  });

  it("hashlock success", async () => {
    const receiverAddress =
      "bcrt1ptv7n7yr2mtjv3cy9m86shzhqragknvsxpx84ygnpmx5h2wpplmlsvuss6c";
    await spendHashlock(
      userKeyPair.publicKey,
      signerKeyPair.publicKey,
      signerKeyPair,
      secretBytes,
      hashedSecret,
      faucetAmount,
      unspentTxId,
      receiverAddress
    );
  });

  it("hashlock failure because wrong secretWord", async () => {
    const receiverAddress =
      "bcrt1ptv7n7yr2mtjv3cy9m86shzhqragknvsxpx84ygnpmx5h2wpplmlsvuss6c";
    try {
      await spendHashlock(
        userKeyPair.publicKey,
        signerKeyPair.publicKey,
        signerKeyPair,
        incorrectSecretBytes,
        hashedSecret,
        faucetAmount,
        unspentTxId,
        receiverAddress
      );
      assert.fail();
    } catch (err) {}
  });

  it("hashlock failure because signer is attacker", async () => {
    const receiverAddress =
      "bcrt1ptv7n7yr2mtjv3cy9m86shzhqragknvsxpx84ygnpmx5h2wpplmlsvuss6c";
    try {
      await spendHashlock(
        userKeyPair.publicKey,
        signerKeyPair.publicKey,
        attackerKeyPair,
        secretBytes,
        hashedSecret,
        faucetAmount,
        unspentTxId,
        receiverAddress
      );
      assert.fail();
    } catch (err) {}
  });
});
