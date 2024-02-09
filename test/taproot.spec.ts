import * as assert from "assert";
import { describe, it } from "mocha";
import {
  setupTaprootAndFaucet,
  spendMultisig,
  spendHashlock,
  randomKeyPair,
} from ".";
import { Signer } from "bitcoinjs-lib";
import { VaultParams } from "../src/types";
import { bitcoinjs } from "../src/wrappers/bitcoinjs-wrapper";
import { buildVaultP2TR } from "../src/vault-builder";

describe("taproot integration test", () => {
  const userKeyPair: Signer = randomKeyPair();
  const signerKeyPair: Signer = randomKeyPair();
  const attackerKeyPair: Signer = randomKeyPair();

  const secretBytes: Buffer = Buffer.from("topsecret!@#");
  const hashedSecret: Buffer = bitcoinjs.crypto.hash160(secretBytes);
  const incorrectSecretBytes: Buffer = Buffer.from("joemama420");

  const salt: number = 0;

  const vaultParams: VaultParams = {
    userPubKey: userKeyPair.publicKey,
    signerPubKey: signerKeyPair.publicKey,
    hashedSecret,
    salt,
  };

  const faucetAmount: number = 42e4;
  const receiverAddress =
    "bcrt1ptv7n7yr2mtjv3cy9m86shzhqragknvsxpx84ygnpmx5h2wpplmlsvuss6c";

  let unspentTxId: string;
  beforeEach(async () => {
    const setupResult = await setupTaprootAndFaucet(vaultParams, faucetAmount);
    unspentTxId = setupResult.unspentTxId;
  });

  it("different salts result in different vaults", async () => {
    const { userPubKey, signerPubKey, hashedSecret } = vaultParams;

    const { address: address1 } = await setupTaprootAndFaucet(
      {
        userPubKey,
        signerPubKey,
        hashedSecret,
        salt: 0,
      },
      faucetAmount
    );
    const { address: address2 } = await setupTaprootAndFaucet(
      {
        userPubKey,
        signerPubKey,
        hashedSecret,
        salt: 2,
      },
      faucetAmount
    );

    assert.notEqual(address1, address2);
  });

  it("multisig success", async () => {
    await spendMultisig(
      vaultParams,
      userKeyPair,
      signerKeyPair,
      faucetAmount,
      unspentTxId,
      receiverAddress
    );
  });

  it("multisig failure because user not signed", async () => {
    try {
      await spendMultisig(
        vaultParams,
        null,
        signerKeyPair,
        faucetAmount,
        unspentTxId,
        receiverAddress
      );
      assert.fail();
    } catch (err) {}
  });

  it("multisig failure because backend not signed", async () => {
    try {
      await spendMultisig(
        vaultParams,
        userKeyPair,
        null,
        faucetAmount,
        unspentTxId,
        receiverAddress
      );
      assert.fail();
    } catch (err) {}
  });

  it("multisig failure because user is attacker", async () => {
    try {
      await spendMultisig(
        vaultParams,
        attackerKeyPair,
        signerKeyPair,
        faucetAmount,
        unspentTxId,
        receiverAddress
      );
      assert.fail();
    } catch (err) {}
  });

  it("multisig failure because backend is attacker", async () => {
    try {
      await spendMultisig(
        vaultParams,
        userKeyPair,
        attackerKeyPair,
        faucetAmount,
        unspentTxId,
        receiverAddress
      );
      assert.fail();
    } catch (err) {}
  });

  it("hashlock success", async () => {
    await spendHashlock(
      vaultParams,
      signerKeyPair,
      secretBytes,
      faucetAmount,
      unspentTxId,
      receiverAddress
    );
  });

  it("hashlock failure because wrong secretWord", async () => {
    try {
      await spendHashlock(
        vaultParams,
        signerKeyPair,
        incorrectSecretBytes,
        faucetAmount,
        unspentTxId,
        receiverAddress
      );
      assert.fail();
    } catch (err) {}
  });

  it("hashlock failure because backend not signed", async () => {
    try {
      await spendHashlock(
        vaultParams,
        null,
        secretBytes,
        faucetAmount,
        unspentTxId,
        receiverAddress
      );
      assert.fail();
    } catch (err) {}
  });

  it("hashlock failure because signer is attacker", async () => {
    try {
      await spendHashlock(
        vaultParams,
        attackerKeyPair,
        secretBytes,
        faucetAmount,
        unspentTxId,
        receiverAddress
      );
      assert.fail();
    } catch (err) {}
  });
});
