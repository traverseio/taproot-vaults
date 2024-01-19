const schnorr = require("bip-schnorr");

export function liftX(Px: Buffer): Buffer {
  return schnorr.math.liftX(Px).affineX.toBuffer();
}
