import * as dotenv from "dotenv";

// Load .env before running the app or importing any other files
dotenv.config();

// if () {
//   throw new Error(
//     "Some environment variables are not set properly. See .env.example"
//   );
// }

import * as ecpair from "ecpair";
import {
  generateRandomKeypair,
  getP2PKHAddress,
  toXOnly,
  tweakSigner,
} from "./utils/taproot-utils";
import { Signer } from "ecpair";
import { broadcast, waitUntilUTXO } from "./utils/blockstream-utils";
import { Taptree } from "bitcoinjs-lib/src/types";
import { witnessStackToScriptWitness } from "./utils/witness-utils";
import { bitcoinjs } from "./bitcoinjs-wrapper";
import { constructP2TR } from "./builder";
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

console.log(`Selected network:\n`, JSON.stringify(NETWORK, null, 2), "\n");

async function main() {
  const userKeypair = generateRandomKeypair({ network: NETWORK });
  const signerKeypair = generateRandomKeypair({ network: NETWORK });
  testSchnorr(userKeypair, signerKeypair);
  await startP2PKTR(userKeypair, signerKeypair);
  await startTaptree(userKeypair, signerKeypair);
}

function testSchnorr(userKeypair: Signer, signerKeypair: Signer) {
  // Combine pubkeys
  const combinedPubkey = combinePubkeys([
    toXOnly(userKeypair.publicKey),
    toXOnly(signerKeypair.publicKey),
  ]);

  const message = Buffer.from(
    "9d156b9ca7bdcd65bce3e8f32d4c4286d89429f422e85faa6b1a2296e04b0a56",
    "hex"
  );
  const session1 = initSignerSession({
    signer: userKeypair,
    idx: 0,
    publicData: {
      message,
      pubkeys: [
        toXOnly(userKeypair.publicKey),
        toXOnly(signerKeypair.publicKey),
      ],
    },
  });
  const session2 = initSignerSession({
    signer: signerKeypair,
    idx: 1,
    publicData: {
      message,
      pubkeys: [
        toXOnly(userKeypair.publicKey),
        toXOnly(signerKeypair.publicKey),
      ],
    },
  });

  const nonces = [session1.nonce, session2.nonce];

  // All parties do this individually & verify
  const combinedNonce = combineNonces({
    localSession: session1,
    publicData: {
      nonces,
    },
  });

  const partialSig1 = partialSign({
    localSession: session1,
    publicData: {
      message,
      combinedNonce: combinedNonce,
      combinedPubkey: combinedPubkey.pubkey,
    },
  });
  const partialSig2 = partialSign({
    localSession: session2,
    publicData: {
      message,
      combinedNonce: combinedNonce,
      combinedPubkey: combinedPubkey.pubkey,
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
      combinedPubkey: combinedPubkey.pubkey,
      signature: sig,
    },
  });
}

async function startP2PKTR(userKeypair: Signer, signerKeypair: Signer) {
  console.log(`Running "Pay to Pubkey with taproot example"`);

  // Combine pubkeys
  const combinedPubkey = combinePubkeys([
    toXOnly(userKeypair.publicKey),
    toXOnly(signerKeypair.publicKey),
  ]);

  // Generate an address from the tweaked public key
  const p2pktr = bitcoinjs.payments.p2tr({
    pubkey: combinedPubkey.pubkey,
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
    tapInternalKey: combinedPubkey.pubkey,
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
 */
async function startTaptree(userKeypair: Signer, signerKeypair: Signer) {
  const secret_bytes = Buffer.from("SECRET");
  const hash = bitcoinjs.crypto.hash160(secret_bytes);

  // Construct scripts
  // Script #1: P2PK script
  const p2pkScript = bitcoinjs.script.fromASM(
    `${toXOnly(userKeypair.publicKey).toString("hex")} OP_CHECKSIG`
  );
  // Script #2: pay to hash_lock_keypair if the correct preimage/secret is provided
  const hashlockScript = bitcoinjs.script.fromASM(
    `OP_HASH160 ${hash.toString("hex")} OP_EQUALVERIFY ${toXOnly(
      signerKeypair.publicKey
    ).toString("hex")} OP_CHECKSIG`
  );

  // Construct MAST
  const scriptTree: Taptree = [
    {
      output: p2pkScript,
    },
    {
      output: hashlockScript,
    },
  ];

  const hashlockRedeem = {
    output: hashlockScript,
    redeemVersion: 192,
  };
  const p2pkRedeem = {
    output: p2pkScript,
    redeemVersion: 192,
  };

  // Combine both pubkeys to use as internal pubkey
  const combinedPubkey = combinePubkeys([
    toXOnly(userKeypair.publicKey),
    toXOnly(signerKeypair.publicKey),
  ]);

  const scriptP2TR = constructP2TR(combinedPubkey.pubkey, scriptTree, NETWORK);
  const scriptAddress = scriptP2TR.address!;

  const p2pkP2TR = constructP2TR(
    combinedPubkey.pubkey,
    scriptTree,
    NETWORK,
    p2pkRedeem
  );
  const hashlockP2TR = constructP2TR(
    combinedPubkey.pubkey,
    scriptTree,
    NETWORK,
    hashlockRedeem
  );

  console.log(
    `Waiting till UTXO is detected at script address: ${scriptAddress}`
  );
  let utxos = await waitUntilUTXO(scriptAddress);

  console.log(
    `Trying the P2PK path with UTXO ${utxos[0].txid}:${utxos[0].vout}`
  );

  const p2pkPSBT = new bitcoinjs.Psbt({ network: NETWORK });

  p2pkPSBT.addInput({
    hash: utxos[0].txid,
    index: utxos[0].vout,
    witnessUtxo: { value: utxos[0].value, script: p2pkP2TR.output! },
    tapLeafScript: [
      {
        leafVersion: p2pkRedeem.redeemVersion,
        script: p2pkRedeem.output,
        controlBlock: p2pkP2TR.witness![p2pkP2TR.witness!.length - 1],
      },
    ],
  });

  p2pkPSBT.addOutput({
    address: getP2PKHAddress(userKeypair.publicKey)!,
    value: utxos[0].value - 150,
  });

  p2pkPSBT.signInput(0, userKeypair);
  p2pkPSBT.finalizeAllInputs();

  let tx = p2pkPSBT.extractTransaction();
  console.log(`Broadcasting Transaction Hex: ${tx.toHex()}`);
  let txid = await broadcast(tx.toHex());
  console.log(`Success! Txid is ${txid}`);

  console.log(
    `Waiting till UTXO is detected at script address: ${scriptAddress}`
  );
  utxos = await waitUntilUTXO(scriptAddress);
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
    const scriptSolution = [input.tapScriptSig[0].signature, secret_bytes];
    const witness = scriptSolution
      .concat(tapLeafScript.script)
      .concat(tapLeafScript.controlBlock);

    return {
      finalScriptWitness: witnessStackToScriptWitness(witness),
    };
  };

  psbt.finalizeInput(0, customFinalizer);

  tx = psbt.extractTransaction();
  console.log(`Broadcasting Transaction Hex: ${tx.toHex()}`);
  txid = await broadcast(tx.toHex());
  console.log(`Success! Txid is ${txid}`);

  // We can also spend from script address without using the script tree
  console.log(
    `Waiting till UTXO is detected at script address: ${scriptAddress}`
  );
  utxos = await waitUntilUTXO(scriptAddress);
  console.log(
    `Trying the Hash lock spend path with UTXO ${utxos[0].txid}:${utxos[0].vout}`
  );

  const keyspendPSBT = new bitcoinjs.Psbt({ network: NETWORK });
  keyspendPSBT.addInput({
    hash: utxos[0].txid,
    index: utxos[0].vout,
    witnessUtxo: { value: utxos[0].value, script: scriptP2TR.output! },
    tapInternalKey: combinedPubkey.pubkey,
    tapMerkleRoot: scriptP2TR.hash,
  });

  keyspendPSBT.addOutput({
    address: getP2PKHAddress(userKeypair.publicKey)!,
    value: utxos[0].value - 150,
  });

  // We need to create a signer tweaked by script tree's merkle root
  const tweakedSigner = tweakSigner(userKeypair, {
    tweakHash: scriptP2TR.hash,
  });
  keyspendPSBT.signInput(0, tweakedSigner);
  keyspendPSBT.finalizeAllInputs();

  tx = keyspendPSBT.extractTransaction();
  console.log(`Broadcasting Transaction Hex: ${tx.toHex()}`);
  txid = await broadcast(tx.toHex());
  console.log(`Success! Txid is ${txid}`);
}
main();
