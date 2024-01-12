const schnorr = require("bip-schnorr");
import BigInteger from "bigi";
import * as ethers from "ethers";
import { Signer } from "ecpair";
import { toXOnly } from "./taproot-utils";
import { PrivateMuSigData, PublicMuSigData } from "../types";

export function combinePubkeys(pubkeys: Buffer[]): Buffer {
  const combinedPubkey = schnorr.muSig.pubKeyCombine(pubkeys);
  return schnorr.convert.intToBuffer(combinedPubkey.affineX);
}

export function sign(privateKey: BigInteger) {
  // TODO
}

// TODO: separate signer logic from combiner logic
export function combineSignatures(signers: Signer[]) {
  // data known to every participant
  const publicData: PublicMuSigData = {
    pubKeys: signers.map((signer) => toXOnly(signer.publicKey)),
    message: schnorr.convert.hash(Buffer.from("muSig is awesome!", "utf8")),
    commitments: [],
    nonces: [],
    partialSignatures: [],
  };

  // data only known by the individual party, these values are never shared
  // between the signers!
  const signerPrivateData: PrivateMuSigData[] = signers.map((signer) => ({
    privateKey: BigInteger.fromBuffer((signer as any).privateKey),
  }));

  // -----------------------------------------------------------------------
  // Step 1: Combine the public keys
  // The public keys P_i are combined into the combined public key P.
  // This can be done by every signer individually or by the initializing
  // party and then be distributed to every participant.
  // -----------------------------------------------------------------------
  publicData.pubKeyHash = schnorr.muSig.computeEll(publicData.pubKeys);
  const pkCombined = schnorr.muSig.pubKeyCombine(
    publicData.pubKeys,
    publicData.pubKeyHash
  );
  publicData.pubKeyCombined = schnorr.convert.intToBuffer(pkCombined.affineX);
  publicData.pubKeyParity = schnorr.math.isEven(pkCombined);

  // -----------------------------------------------------------------------
  // Step 2: Create the private signing session
  // Each signing party does this in private. The session ID *must* be
  // unique for every call to sessionInitialize, otherwise it's trivial for
  // an attacker to extract the secret key!
  // -----------------------------------------------------------------------
  signerPrivateData.forEach((data, idx) => {
    const sessionId = Buffer.from(ethers.randomBytes(32)); // must never be reused between sessions!
    data.session = schnorr.muSig.sessionInitialize(
      sessionId,
      data.privateKey,
      publicData.message,
      publicData.pubKeyCombined,
      publicData.pubKeyParity,
      publicData.pubKeyHash,
      idx
    );
  });
  const signerSession = signerPrivateData[0].session;

  // -----------------------------------------------------------------------
  // Step 3: Exchange commitments (communication round 1)
  // The signers now exchange the commitments H(R_i). This is simulated here
  // by copying the values from the private data to public data array.
  // -----------------------------------------------------------------------
  for (let i = 0; i < publicData.pubKeys.length; i++) {
    publicData.commitments[i] = signerPrivateData[i].session!.commitment;
  }

  // -----------------------------------------------------------------------
  // Step 4: Get nonces (communication round 2)
  // Now that everybody has commited to the session, the nonces (R_i) can be
  // exchanged. Again, this is simulated by copying.
  // -----------------------------------------------------------------------
  for (let i = 0; i < publicData.pubKeys.length; i++) {
    publicData.nonces[i] = signerPrivateData[i].session!.nonce;
  }

  // -----------------------------------------------------------------------
  // Step 5: Combine nonces
  // The nonces can now be combined into R. Each participant should do this
  // and keep track of whether the nonce was negated or not. This is needed
  // for the later steps.
  // -----------------------------------------------------------------------
  publicData.nonceCombined = schnorr.muSig.sessionNonceCombine(
    signerSession,
    publicData.nonces
  );
  signerPrivateData.forEach(
    (data) =>
      (data.session!.combinedNonceParity = signerSession!.combinedNonceParity)
  );

  // -----------------------------------------------------------------------
  // Step 6: Generate partial signatures
  // Every participant can now create their partial signature s_i over the
  // given message.
  // -----------------------------------------------------------------------
  signerPrivateData.forEach((data) => {
    data.partialSignature = schnorr.muSig.partialSign(
      data.session,
      publicData.message,
      publicData.nonceCombined,
      publicData.pubKeyCombined
    );
  });

  // -----------------------------------------------------------------------
  // Step 7: Exchange partial signatures (communication round 3)
  // The partial signature of each signer is exchanged with the other
  // participants. Simulated here by copying.
  // -----------------------------------------------------------------------
  for (let i = 0; i < publicData.pubKeys.length; i++) {
    publicData.partialSignatures[i] = signerPrivateData[i].partialSignature!;
  }

  // -----------------------------------------------------------------------
  // Step 8: Combine partial signatures
  // Finally, the partial signatures can be combined into the full signature
  // (s, R) that can be verified against combined public key P.
  // -----------------------------------------------------------------------
  publicData.signature = schnorr.muSig.partialSigCombine(
    publicData.nonceCombined,
    publicData.partialSignatures
  );
}

// TODO
export function verifySigs() {
  // // -----------------------------------------------------------------------
  // // Verify individual partial signatures
  // // Every participant should verify the partial signatures received by the
  // // other participants.
  // // -----------------------------------------------------------------------
  // for (let i = 0; i < publicData.pubKeys.length; i++) {
  //   schnorr.muSig.partialSigVerify(
  //     signerSession,
  //     publicData.partialSignatures[i],
  //     publicData.nonceCombined,
  //     i,
  //     publicData.pubKeys[i],
  //     publicData.nonces[i]
  //   );
  // }
  // // -----------------------------------------------------------------------
  // // Verify signature
  // // The resulting signature can now be verified as a normal Schnorr
  // // signature (s, R) over the message m and public key P.
  // // -----------------------------------------------------------------------
  // schnorr.verify(
  //   publicData.pubKeyCombined,
  //   publicData.message,
  //   publicData.signature
  // );
}
