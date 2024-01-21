import * as assert from "assert";
import { describe, it } from "mocha";
import {
  setupTaprootAndFaucet,
  spendMultisig,
  spendHashlock,
  randomKeyPair,
} from ".";
import { Signer } from "bitcoinjs-lib";

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
    userKeyPair = randomKeyPair();
    signerKeyPair = randomKeyPair();
    attackerKeyPair = randomKeyPair();
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

  it("hashlock failure because backend not signed", async () => {
    const receiverAddress =
      "bcrt1ptv7n7yr2mtjv3cy9m86shzhqragknvsxpx84ygnpmx5h2wpplmlsvuss6c";
    try {
      await spendHashlock(
        userKeyPair.publicKey,
        signerKeyPair.publicKey,
        null,
        secretBytes,
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
