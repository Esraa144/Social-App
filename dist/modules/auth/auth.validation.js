"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enableTwoStepSchema = exports.updateInfo = exports.updatePassword = exports.resetForgotPassword = exports.verifyForgotPassword = exports.sendForgotPasswordCode = exports.signupWithGmail = exports.confirmEmail = exports.signup = exports.login = void 0;
const zod_1 = require("zod");
const validation_middleware_1 = require("../../middleware/validation.middleware");
exports.login = {
    body: zod_1.z.strictObject({
        email: validation_middleware_1.generalFields.email,
        password: validation_middleware_1.generalFields.password,
    }),
};
exports.signup = {
    body: exports.login.body
        .extend({
        userName: validation_middleware_1.generalFields.userName,
        confirmPassword: validation_middleware_1.generalFields.confirmPassword,
    })
        .superRefine((data, ctx) => {
        if (data.confirmPassword !== data.password) {
            ctx.addIssue({
                code: "custom",
                path: ["confirmPassword"],
                message: "Password mismatch confirmPassword",
            });
        }
    }),
};
exports.confirmEmail = {
    body: zod_1.z.strictObject({
        email: validation_middleware_1.generalFields.email,
        otp: validation_middleware_1.generalFields.otp,
    }),
};
exports.signupWithGmail = {
    body: zod_1.z.strictObject({
        idToken: zod_1.z.string(),
    }),
};
exports.sendForgotPasswordCode = {
    body: zod_1.z.strictObject({
        email: validation_middleware_1.generalFields.email,
    }),
};
exports.verifyForgotPassword = {
    body: exports.sendForgotPasswordCode.body.extend({
        otp: validation_middleware_1.generalFields.otp,
    }),
};
exports.resetForgotPassword = {
    body: exports.verifyForgotPassword.body
        .extend({
        otp: validation_middleware_1.generalFields.otp,
        password: validation_middleware_1.generalFields.password,
        confirmPassword: validation_middleware_1.generalFields.confirmPassword,
    })
        .refine((data) => {
        return data.password === data.confirmPassword;
    }, {
        message: "Password mismatch confirm-password",
        path: ["confirmPassword"],
    }),
};
exports.updatePassword = {
    body: zod_1.z
        .object({
        oldPassword: validation_middleware_1.generalFields.password,
        newPassword: validation_middleware_1.generalFields.password,
        confirmPassword: validation_middleware_1.generalFields.confirmPassword,
    })
        .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Password mismatch confirm-password",
        path: ["confirmPassword"],
    }),
};
exports.updateInfo = {
    body: zod_1.z.object({
        userName: validation_middleware_1.generalFields.userName.optional(),
        phone: validation_middleware_1.generalFields.phone.optional(),
        bio: validation_middleware_1.generalFields.bio.optional(),
    }),
};
exports.enableTwoStepSchema = {
    body: zod_1.z.object({
        twoStepEnabled: validation_middleware_1.generalFields.twoStepEnabled,
    }),
};
