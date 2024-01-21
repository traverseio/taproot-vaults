/// <reference types="node" />
import { Network } from "bitcoinjs-lib";
import * as ecpair from "ecpair";
export declare function randomKeyPair(network: Network): ecpair.ECPairInterface;
export declare function loadKeyPair(privateKey: Buffer, network: Network): ecpair.ECPairInterface;
export declare function toXOnly(pubKey: Buffer): Buffer;
