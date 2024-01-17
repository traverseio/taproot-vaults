import * as dotenv from "dotenv";

// Load .env before running the app or importing any other files
dotenv.config();

import * as ecpair from "ecpair";
import {
  randomKeypair,
  getP2PKHAddress,
  toXOnly,
  loadKeypair,
} from "./utils/taproot-utils";
import { broadcast, waitUntilUTXO } from "./utils/blockstream-utils";
import { Taptree } from "bitcoinjs-lib/src/types";
import { witnessStackToScriptWitness } from "./utils/witness-utils";
import { bitcoinjs } from "./bitcoinjs-wrapper";
import { constructP2TR } from "./builder";
import { buildScripts } from "./vault-scripts";
import {
  combineNonces,
  combinePubkeys,
  combineSignatures,
  initSignerSession,
  partialSign,
  verifySignature,
} from "./utils/muSig-utils";

// vars
const NETWORK = ecpair.networks.testnet;
const INVALID_ADDRESS = toXOnly(
  Buffer.from("bc1pnej5w4rdkud7z8exy7dcmykrfrc6usle2pvq9ktjgedjjl4e2ges7aaaaa")
);

console.log(`Selected network prefix:`, NETWORK.bech32, "\n");

async function main() {
  const userKeypair = randomKeypair({ network: NETWORK });
  const signerKeypair = randomKeypair({ network: NETWORK });
  testSchnorr(userKeypair, signerKeypair);
  await startP2PKTR(userKeypair, signerKeypair);
  await startTaptree(userKeypair, signerKeypair);
}

function testSchnorr(
  userKeypair: ecpair.ECPairInterface,
  signerKeypair: ecpair.ECPairInterface
) {
  const xOnlyPubKeys = [
    toXOnly(userKeypair.publicKey),
    toXOnly(signerKeypair.publicKey),
  ];

  // Combine pubkeys
  const combinedPubkey = combinePubkeys(xOnlyPubKeys);

  const message = Buffer.from(
    "9d156b9ca7bdcd65bce3e8f32d4c4286d89429f422e85faa6b1a2296e04b0a56",
    "hex"
  );
  const session1 = initSignerSession({
    signer: userKeypair,
    idx: 0,
    publicData: {
      message,
      xOnlyPubKeys: xOnlyPubKeys,
    },
  });
  const session2 = initSignerSession({
    signer: signerKeypair,
    idx: 1,
    publicData: {
      message,
      xOnlyPubKeys: xOnlyPubKeys,
    },
  });

  const nonces = [session1.nonce, session2.nonce];

  // All parties do this individually & verify
  const combinedNonce1 = combineNonces({
    localSession: session1,
    publicData: {
      nonces,
    },
  });
  const combinedNonce2 = combineNonces({
    localSession: session2,
    publicData: {
      nonces,
    },
  });

  if (!combinedNonce1.equals(combinedNonce2)) {
    throw new Error("Mismatched combinedNonce");
  }

  const combinedNonce = combinedNonce1;

  const partialSig1 = partialSign({
    localSession: session1,
    publicData: {
      message,
      combinedNonce: combinedNonce,
      combinedPubkey: combinedPubkey.pubKey,
    },
  });
  const partialSig2 = partialSign({
    localSession: session2,
    publicData: {
      message,
      combinedNonce: combinedNonce,
      combinedPubkey: combinedPubkey.pubKey,
    },
  });

  const sig = combineSignatures({
    publicData: {
      message,
      combinedNonce: combinedNonce,
      partialSignatures: [partialSig1, partialSig2],
    },
  });

  verifySignature({
    publicData: {
      message,
      combinedPubkey: combinedPubkey.pubKey,
      signature: sig,
    },
  });
  console.log("Schnorr signature verification succeeded");
}

async function startP2PKTR(
  userKeypair: ecpair.ECPairInterface,
  signerKeypair: ecpair.ECPairInterface
) {
  console.log(`Running "Pay to Pubkey with taproot example"`);

  // Combine pubkeys
  const combinedPubkey = combinePubkeys([
    toXOnly(userKeypair.publicKey),
    toXOnly(signerKeypair.publicKey),
  ]);

  // Generate an address from the tweaked public key
  const p2pktr = bitcoinjs.payments.p2tr({
    pubkey: combinedPubkey.pubKey,
    network: NETWORK,
  });
  const p2pktr_addr = p2pktr.address ?? "";
  console.log(`Waiting till UTXO is detected at this Address: ${p2pktr_addr}`);

  const utxos = await waitUntilUTXO(p2pktr_addr);
  console.log(`Using UTXO ${utxos[0].txid}:${utxos[0].vout}`);

  const psbt = new bitcoinjs.Psbt({ network: NETWORK });
  psbt.addInput({
    hash: utxos[0].txid,
    index: utxos[0].vout,
    witnessUtxo: { value: utxos[0].value, script: p2pktr.output! },
    tapInternalKey: combinedPubkey.pubKey,
  });

  psbt.addOutput({
    address: getP2PKHAddress(userKeypair.publicKey)!,
    value: utxos[0].value - 150,
  });

  // TODO: generate muSig signature using signers
  psbt.finalizeAllInputs();

  const tx = psbt.extractTransaction();
  console.log(`Broadcasting Transaction Hex: ${tx.toHex()}`);
  const txid = await broadcast(tx.toHex());
  console.log(`Success! Txid is ${txid}`);
}

/**
 * Create a tap tree with two spend paths. One path should allow spending using secret,
 * the other path should pay to another pubkey
 *
 * @param userKeypair
 * @param signerKeypair
 */
async function startTaptree(
  userKeypair: ecpair.ECPairInterface,
  signerKeypair: ecpair.ECPairInterface
) {
  const secretAnswer = Buffer.from("SECRET");
  const secretHash = bitcoinjs.crypto.hash160(secretAnswer);

  const { multisigScript, hashlockScript } = buildScripts(
    userKeypair.publicKey,
    signerKeypair.publicKey,
    secretHash
  );

  // Construct MAST
  const scriptTree: Taptree = [
    {
      output: multisigScript,
    },
    {
      output: hashlockScript,
    },
  ];
  const scriptP2TR = constructP2TR(INVALID_ADDRESS, scriptTree, NETWORK);
  const scriptAddress = scriptP2TR.address!;

  {
    // Scenario #1: multisig
    const multisigRedeem = {
      output: multisigScript,
      redeemVersion: 192,
    };
    const multisigP2TR = constructP2TR(
      INVALID_ADDRESS,
      scriptTree,
      NETWORK,
      multisigRedeem
    );
    // We can also spend from script address without using the script tree
    console.log(
      `Waiting till UTXO is detected at script address: ${scriptAddress}`
    );
    const utxos = await waitUntilUTXO(scriptAddress);
    console.log(
      `Trying the multisig lock spend path with UTXO ${utxos[0].txid}:${utxos[0].vout}`
    );

    const tapLeafScript = {
      leafVersion: multisigRedeem.redeemVersion,
      script: multisigRedeem.output,
      controlBlock: multisigP2TR.witness![multisigP2TR.witness!.length - 1],
    };

    const psbt = new bitcoinjs.Psbt({ network: NETWORK });
    psbt.addInput({
      hash: utxos[0].txid,
      index: utxos[0].vout,
      witnessUtxo: { value: utxos[0].value, script: multisigP2TR.output! },
      tapLeafScript: [tapLeafScript],
    });

    psbt.addOutput({
      address: getP2PKHAddress(userKeypair.publicKey)!,
      value: utxos[0].value - 150,
    });
    psbt.signInput(0, signerKeypair).signInput(0, userKeypair);
    psbt.finalizeInput(0);

    const tx = psbt.extractTransaction();
    console.log(`Broadcasting Transaction Hex: ${tx.toHex()}`);
    const txid = await broadcast(tx.toHex());
    console.log(`Success! Txid is ${txid}`);
  }
  {
    // Scenario #2: Secret pass
    const hashlockRedeem = {
      output: hashlockScript,
      redeemVersion: 192,
    };
    const hashlockP2TR = constructP2TR(
      INVALID_ADDRESS,
      scriptTree,
      NETWORK,
      hashlockRedeem
    );
    // We can also spend from script address without using the script tree
    console.log(
      `Waiting till UTXO is detected at script address: ${scriptAddress}`
    );
    const utxos = await waitUntilUTXO(scriptAddress);
    console.log(
      `Trying the Hash lock spend path with UTXO ${utxos[0].txid}:${utxos[0].vout}`
    );

    const tapLeafScript = {
      leafVersion: hashlockRedeem.redeemVersion,
      script: hashlockRedeem.output,
      controlBlock: hashlockP2TR.witness![hashlockP2TR.witness!.length - 1],
    };

    const psbt = new bitcoinjs.Psbt({ network: NETWORK });
    psbt.addInput({
      hash: utxos[0].txid,
      index: utxos[0].vout,
      witnessUtxo: { value: utxos[0].value, script: hashlockP2TR.output! },
      tapLeafScript: [tapLeafScript],
    });

    psbt.addOutput({
      address: getP2PKHAddress(userKeypair.publicKey)!,
      value: utxos[0].value - 150,
    });
    psbt.signInput(0, signerKeypair);
    // We have to construct our witness script in a custom finalizer
    const customFinalizer = (_inputIndex: number, input: any) => {
      const scriptSolution = [input.tapScriptSig[0].signature, secretAnswer];
      const witness = scriptSolution
        .concat(tapLeafScript.script)
        .concat(tapLeafScript.controlBlock);

      return {
        finalScriptWitness: witnessStackToScriptWitness(witness),
      };
    };

    psbt.finalizeInput(0, customFinalizer);

    const tx = psbt.extractTransaction();
    console.log(`Broadcasting Transaction Hex: ${tx.toHex()}`);
    const txid = await broadcast(tx.toHex());
    console.log(`Success! Txid is ${txid}`);
  }
}
main();
