"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenModel = void 0;
const mongoose_1 = require("mongoose");
const mongoose_2 = require("mongoose");
const tokenSchema = new mongoose_2.Schema({
    jti: { type: String, required: true, unique: true },
    expiresIn: { type: Number, required: true },
    userId: { type: mongoose_2.Schema.Types.ObjectId, ref: "User", required: true },
}, {
    timestamps: true,
});
exports.TokenModel = mongoose_1.models.Token || (0, mongoose_1.model)("Token", tokenSchema);
