const schnorr = require("bip-schnorr");
import BigInteger from "bigi";
import * as ethers from "ethers";
import * as ecpair from "ecpair";
import { MuSigSession } from "../types";

// =========== GENERAL =========== //

export function combinePubkeys(pubkeys: Buffer[]): {
  pubkeyHash: Buffer;
  pubkey: Buffer;
  pubkeyParity: boolean;
} {
  const pubkeyHash = schnorr.muSig.computeEll(pubkeys);
  const rawCombined = schnorr.muSig.pubKeyCombine(pubkeys, pubkeyHash);
  const pubkey = schnorr.convert.intToBuffer(rawCombined.affineX);
  const pubkeyParity = schnorr.math.isEven(rawCombined);

  return { pubkeyHash, pubkey, pubkeyParity };
}

// =========== SIGNERS =========== //

export function initSignerSession({
  signer,
  idx,
  publicData,
}: {
  signer: ecpair.Signer;
  idx: number;
  publicData: {
    message: Buffer;
    pubkeys: Buffer[];
  };
}): MuSigSession {
  const { pubkeyHash, pubkey, pubkeyParity } = combinePubkeys(
    publicData.pubkeys
  );
  // The session ID *must* be unique for every call to sessionInitialize, otherwise it's trivial for
  // an attacker to extract the secret key!
  const sessionId = Buffer.from(ethers.randomBytes(32)); // must never be reused between sessions!
  return schnorr.muSig.sessionInitialize(
    sessionId,
    BigInteger.fromBuffer((signer as any).privateKey),
    publicData.message,
    pubkey,
    pubkeyParity,
    pubkeyHash,
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
}) {
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
