import * as ecpair from "ecpair";
import * as tinysecp from "tiny-secp256k1";
import { Signer } from "ecpair";
import { crypto } from "bitcoinjs-lib";
import { bitcoinjs } from "../bitcoinjs-wrapper";

// init
const ecpairFactory = ecpair.ECPairFactory(tinysecp);

export function generateRandomKeypair(opts: any = {}): Signer {
  return ecpairFactory.makeRandom({ network: opts.network });
}

export function tweakSigner(signer: Signer, opts: any = {}): Signer {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  let privateKey: Uint8Array | undefined = signer.privateKey!;
  if (!privateKey) {
    throw new Error("Private key is required for tweaking signer!");
  }
  if (signer.publicKey[0] === 3) {
    privateKey = tinysecp.privateNegate(privateKey);
  }

  const tweakedPrivateKey = tinysecp.privateAdd(
    privateKey,
    tapTweakHash(toXOnly(signer.publicKey), opts.tweakHash)
  );
  if (!tweakedPrivateKey) {
    throw new Error("Invalid tweaked private key!");
  }

  return ecpairFactory.fromPrivateKey(Buffer.from(tweakedPrivateKey), {
    network: opts.network,
  });
}

export function tapTweakHash(pubKey: Buffer, h: Buffer | undefined): Buffer {
  return crypto.taggedHash(
    "TapTweak",
    Buffer.concat(h ? [pubKey, h] : [pubKey])
  );
}

export function toXOnly(pubkey: Buffer): Buffer {
  return pubkey.subarray(1, 33);
}

export function getP2PKHAddress(pubkey: Buffer): string | undefined {
  return bitcoinjs.payments.p2pkh({ pubkey }).address;
}
