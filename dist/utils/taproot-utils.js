"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toXOnly = exports.loadKeyPair = exports.randomKeyPair = void 0;
var ecpair_wrapper_1 = require("../wrappers/ecpair-wrapper");
function randomKeyPair(network) {
    return ecpair_wrapper_1.ecpairFactory.makeRandom({ network: network });
}
exports.randomKeyPair = randomKeyPair;
function loadKeyPair(privateKey, network) {
    return ecpair_wrapper_1.ecpairFactory.fromPrivateKey(privateKey, { network: network });
}
exports.loadKeyPair = loadKeyPair;
function toXOnly(pubKey) {
    return pubKey.length === 32 ? pubKey : pubKey.subarray(1, 33);
}
exports.toXOnly = toXOnly;
