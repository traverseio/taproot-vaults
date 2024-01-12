import * as btcjs from "bitcoinjs-lib";
import * as tinysecp from "tiny-secp256k1";

btcjs.initEccLib(tinysecp);

export { btcjs as bitcoinjs };
