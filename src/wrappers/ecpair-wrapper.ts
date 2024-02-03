import * as ecpair from "ecpair";
import * as tinysecp from "tiny-secp256k1";

// init
export const ecpairFactory = ecpair.ECPairFactory(tinysecp);
