"use strict";
/**
 * This is the file that defines, builds, and interfaces with vaults.
 *
 * @see {@link README.md} for more information around the intended usecase for vaults.
 */
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.finalizeVaultPSBT = exports.buildVaultPSBT = exports.buildVaultP2TR = void 0;
var witness_utils_1 = require("./utils/witness-utils");
var bitcoinjs_wrapper_1 = require("./wrappers/bitcoinjs-wrapper");
var schnorr_utils_1 = require("./utils/schnorr-utils");
var taproot_utils_1 = require("./utils/taproot-utils");
// Nothing Up My Sleeve (NUMS) address is used because vaults are intended to be used without an internal pubkey
// https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#:~:text=H%20%3D%20lift_x(0x50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0)
var NUMS_ADDRESS = (0, schnorr_utils_1.liftX)(Buffer.from("50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0", "hex"));
/**
 * Construct (or reconstruct) a vault P2TR with the given params
 *
 * @param script the optional script to use when initializing a payment
 */
function buildVaultP2TR(vaultParams, network, script) {
    // unpack vault params
    var userPubKey = vaultParams.userPubKey, signerPubKey = vaultParams.signerPubKey, hashedSecret = vaultParams.hashedSecret;
    // build scripts
    var scriptTree = buildScripts(userPubKey, signerPubKey, hashedSecret).scriptTree;
    return bitcoinjs_wrapper_1.bitcoinjs.payments.p2tr({
        internalPubkey: (0, taproot_utils_1.toXOnly)(NUMS_ADDRESS),
        scriptTree: scriptTree,
        network: network,
        redeem: script && {
            output: script,
            redeemVersion: 192,
        },
    });
}
exports.buildVaultP2TR = buildVaultP2TR;
/**
 * Initialize unsigned, unfinalized PSBT
 * @param vaultParams
 * @param signerSig
 * @param inputs
 * @param outputs
 * @returns
 */
function buildVaultPSBT(vaultParams, inputs, outputs, spendScript, network) {
    var e_1, _a, e_2, _b;
    var userPubKey = vaultParams.userPubKey, signerPubKey = vaultParams.signerPubKey, hashedSecret = vaultParams.hashedSecret;
    // reconstruct scripts
    var _c = buildScripts(userPubKey, signerPubKey, hashedSecret), multisigScript = _c.multisigScript, hashlockScript = _c.hashlockScript;
    // choose correct script
    var script = spendScript === "multisig" ? multisigScript : hashlockScript;
    var _d = buildVaultP2TR(vaultParams, network, script), output = _d.output, witness = _d.witness, redeem = _d.redeem;
    var psbt = new bitcoinjs_wrapper_1.bitcoinjs.Psbt({ network: network });
    try {
        for (var inputs_1 = __values(inputs), inputs_1_1 = inputs_1.next(); !inputs_1_1.done; inputs_1_1 = inputs_1.next()) {
            var input = inputs_1_1.value;
            psbt.addInput({
                hash: input.txHash,
                index: input.idx,
                witnessUtxo: { value: input.value, script: output },
                tapLeafScript: [
                    {
                        leafVersion: redeem.redeemVersion,
                        script: script,
                        controlBlock: witness[witness.length - 1],
                    },
                ],
            });
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (inputs_1_1 && !inputs_1_1.done && (_a = inputs_1.return)) _a.call(inputs_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    try {
        for (var outputs_1 = __values(outputs), outputs_1_1 = outputs_1.next(); !outputs_1_1.done; outputs_1_1 = outputs_1.next()) {
            var output_1 = outputs_1_1.value;
            psbt.addOutput({ value: output_1.amount, address: output_1.recipient });
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (outputs_1_1 && !outputs_1_1.done && (_b = outputs_1.return)) _b.call(outputs_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return psbt.toHex();
}
exports.buildVaultPSBT = buildVaultPSBT;
/**
 * Finalize hashlock spend with script args after signing inputs
 * @param psbt
 * @param secretBytes
 */
function finalizeVaultPSBT(psbt, spendScript, secretBytes) {
    // pass secret answer for hashlock
    if (spendScript === "hashlock") {
        if (!secretBytes) {
            throw new Error("Secret bytes are required for hashlock spend");
        }
        var customFinalizer_1 = function (_idx, input) {
            var scriptSolution = [input.tapScriptSig[0].signature, secretBytes];
            var witness = scriptSolution
                .concat(input.tapLeafScript[0].script)
                .concat(input.tapLeafScript[0].controlBlock);
            return {
                finalScriptWitness: (0, witness_utils_1.witnessStackToScriptWitness)(witness),
            };
        };
        psbt.txInputs.forEach(function (_input, idx) {
            psbt.finalizeInput(idx, customFinalizer_1);
        });
    }
    else {
        // for multisig script we don't need to do anything special
        psbt.finalizeAllInputs();
    }
    var tx = psbt.extractTransaction();
    return { txHex: tx.toHex(), txHash: tx.getId() };
}
exports.finalizeVaultPSBT = finalizeVaultPSBT;
function buildScripts(userPubKey, signerPubKey, hashedSecret) {
    var multisigScript = bitcoinjs_wrapper_1.bitcoinjs.script.fromASM("".concat((0, taproot_utils_1.toXOnly)(userPubKey).toString("hex"), " OP_CHECKSIG ").concat((0, taproot_utils_1.toXOnly)(signerPubKey).toString("hex"), " OP_CHECKSIGADD OP_2 OP_EQUAL"));
    var hashlockScript = bitcoinjs_wrapper_1.bitcoinjs.script.fromASM("OP_HASH160 ".concat(hashedSecret.toString("hex"), " OP_EQUALVERIFY ").concat((0, taproot_utils_1.toXOnly)(signerPubKey).toString("hex"), " OP_CHECKSIG"));
    // Construct MAST
    var scriptTree = [
        {
            output: multisigScript,
        },
        {
            output: hashlockScript,
        },
    ];
    return {
        multisigScript: multisigScript,
        hashlockScript: hashlockScript,
        scriptTree: scriptTree,
    };
}
