"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmEmail = exports.signup = exports.login = void 0;
const zod_1 = require("zod");
const validation_middeware_1 = require("../../middleware/validation.middeware");
exports.login = {
    body: zod_1.z.strictObject({
        email: validation_middeware_1.generalFields.email,
        password: validation_middeware_1.generalFields.password,
    }),
};
exports.signup = {
    body: exports.login.body
        .extend({
        userName: validation_middeware_1.generalFields.userName,
        confirmPassword: validation_middeware_1.generalFields.confirmPassword,
    })
        .superRefine((data, ctx) => {
        console.log({ data, ctx });
        if (data.confirmPassword !== data.password) {
            ctx.addIssue({
                code: "custom",
                path: ["confirmEmail"],
                message: "Password mismatch confirmPassword",
            });
        }
    }),
};
exports.confirmEmail = {
    body: zod_1.z.strictObject({
        email: validation_middeware_1.generalFields.email,
        otp: validation_middeware_1.generalFields.otp,
    }),
};
