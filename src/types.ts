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

export type VaultParams = {
  userPubKey: Buffer;
  signerPubKey: Buffer;
  hashedSecret: Buffer;
};

export type RawInput = {
  txHash: string;
  idx: number;
  value: number;
};

export type RawOutput = {
  recipient: string;
  amount: number;
};
