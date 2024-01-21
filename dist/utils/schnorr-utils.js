"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.liftX = void 0;
var schnorr = require("bip-schnorr");
function liftX(Px) {
    return schnorr.math.liftX(Px).affineX.toBuffer();
}
exports.liftX = liftX;
