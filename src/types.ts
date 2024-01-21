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
