"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toXOnly = exports.loadKeyPair = exports.randomKeyPair = void 0;
var ecpair = __importStar(require("ecpair"));
var tinysecp = __importStar(require("tiny-secp256k1"));
// init
var ecpairFactory = ecpair.ECPairFactory(tinysecp);
function randomKeyPair(network) {
    return ecpairFactory.makeRandom({ network: network });
}
exports.randomKeyPair = randomKeyPair;
function loadKeyPair(privateKey, network) {
    return ecpairFactory.fromPrivateKey(privateKey, { network: network });
}
exports.loadKeyPair = loadKeyPair;
function toXOnly(pubKey) {
    return pubKey.length === 32 ? pubKey : pubKey.subarray(1, 33);
}
exports.toXOnly = toXOnly;
