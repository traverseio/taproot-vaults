import * as ecpair from "ecpair";
import * as tinysecp from "tiny-secp256k1";
import { crypto } from "bitcoinjs-lib";
import { bitcoinjs } from "../bitcoinjs-wrapper";

// init
const ecpairFactory = ecpair.ECPairFactory(tinysecp);

export function randomKeypair(opts: any): ecpair.ECPairInterface {
  return ecpairFactory.makeRandom(opts);
}

export function loadKeypair(
  privateKey: Buffer,
  opts: any
): ecpair.ECPairInterface {
  return ecpairFactory.fromPrivateKey(privateKey, opts);
}

export function tweakSigner(
  signer: ecpair.ECPairInterface,
  opts: any
): ecpair.ECPairInterface {
  if (!signer.privateKey) {
    throw new Error("Private key is required for tweaking signer");
  }

  let privateKey = Uint8Array.from(signer.privateKey);

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

export function toXOnly(pubKey: Buffer): Buffer {
  return pubKey.length === 32 ? pubKey : pubKey.subarray(1, 33);
}

export function checkXOnly(pubKeys: Buffer[]): void {
  const invalid = pubKeys.find((pubKey) => pubKey.length !== 32);
  if (invalid !== undefined) {
    throw new Error(
      `Found invalid pubKey ${invalid.toString(
        "hex"
      )}: pubKeys must be 32 bytes`
    );
  }
}

export function getP2PKHAddress(pubkey: Buffer): string | undefined {
  return bitcoinjs.payments.p2pkh({ pubkey }).address;
}
