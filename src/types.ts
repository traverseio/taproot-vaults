import BigInteger from "bigi";

export type MuSigSession = {
  sessionId: Buffer;
  message: Buffer;
  pubKeyCombined: Buffer;
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
