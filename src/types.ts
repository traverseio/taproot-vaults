import * as ecurve from "ecurve";
import BigInteger from "bigi";

export type PrivateMuSigData = {
  privateKey: BigInteger;
  session?: MuSigSession;
  partialSignature?: BigInteger;
};

export type MuSigSession = {
  sessionId: Buffer;
  message: Buffer;
  pubKeyCombined: ecurve.Point;
  secretKey: BigInteger;
  ownKeyParity: boolean;
  pkParity: boolean;
  secretNonce: Buffer;
  nonceParity: boolean;
  combinedNonceParity?: boolean;
  nonce: Buffer;
  ell: Buffer;
  idx: number;
  commitment: Buffer;
};

export type PublicMuSigData = {
  pubKeys: Buffer[];
  message: Buffer;
  pubKeyHash?: Buffer;
  pubKeyCombined?: ecurve.Point;
  pubKeyParity?: boolean;
  commitments: Buffer[];
  nonces: Buffer[];
  nonceCombined?: Buffer;
  partialSignatures: BigInteger[];
  signature?: Buffer;
};
