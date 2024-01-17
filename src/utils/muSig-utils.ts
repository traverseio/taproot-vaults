const schnorr = require("bip-schnorr");
import BigInteger from "bigi";
import * as ethers from "ethers";
import * as ecpair from "ecpair";
import { MuSigSession } from "../types";
import { checkXOnly } from "./taproot-utils";

// =========== GENERAL =========== //

export function combinePubkeys(xOnlyPubKeys: Buffer[]): {
  pubKeyHash: Buffer;
  pubKey: Buffer;
  pubKeyParity: boolean;
} {
  // Validate pubKeys
  checkXOnly(xOnlyPubKeys);

  const pubKeyHash = schnorr.muSig.computeEll(xOnlyPubKeys);
  const point = schnorr.muSig.pubKeyCombine(xOnlyPubKeys, pubKeyHash);
  const pubKey = schnorr.convert.intToBuffer(point.affineX);
  const pubKeyParity = schnorr.math.isEven(point);

  return { pubKeyHash, pubKey, pubKeyParity };
}

// =========== SIGNERS =========== //

export function initSignerSession({
  signer,
  idx,
  publicData,
}: {
  signer: ecpair.ECPairInterface;
  idx: number;
  publicData: {
    message: Buffer;
    xOnlyPubKeys: Buffer[];
  };
}): MuSigSession {
  // Validate pubKeys
  checkXOnly(publicData.xOnlyPubKeys);

  const { pubKeyHash, pubKey, pubKeyParity } = combinePubkeys(
    publicData.xOnlyPubKeys
  );
  // The session ID *must* be unique for every call to sessionInitialize, otherwise it's trivial for
  // an attacker to extract the secret key!
  const sessionID = Buffer.from(ethers.randomBytes(32)); // must never be reused between sessions!
  return schnorr.muSig.sessionInitialize(
    sessionID,
    BigInteger.fromBuffer(signer.privateKey),
    publicData.message,
    pubKey,
    pubKeyParity,
    pubKeyHash,
    idx
  );
}

export function combineNonces({
  localSession,
  publicData,
}: {
  localSession: MuSigSession;
  publicData: {
    nonces: Buffer[];
  };
}): Buffer {
  // Appends combinedNonceParity attribute to session and returns combinedNonce
  return schnorr.muSig.sessionNonceCombine(localSession, publicData.nonces);
}

export function partialSign({
  localSession,
  publicData,
}: {
  localSession: MuSigSession;
  publicData: {
    message: Buffer;
    combinedNonce: Buffer;
    combinedPubkey: Buffer;
  };
}) {
  return schnorr.muSig.partialSign(
    localSession,
    publicData.message,
    publicData.combinedNonce,
    publicData.combinedPubkey
  );
}

// =========== COMBINER =========== //

export function combineSignatures({
  publicData,
}: {
  publicData: {
    message: Buffer;
    combinedNonce: Buffer;
    partialSignatures: Buffer[];
  };
}) {
  return schnorr.muSig.partialSigCombine(
    publicData.combinedNonce,
    publicData.partialSignatures
  );
}

// TODO: verify partial signatures locally
export function verifySignature({
  publicData,
}: {
  publicData: {
    message: Buffer;
    combinedPubkey: Buffer;
    signature: Buffer;
  };
}) {
  schnorr.verify(
    publicData.combinedPubkey,
    publicData.message,
    publicData.signature
  );
}
