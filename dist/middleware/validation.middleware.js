"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generalFields = exports.validation = void 0;
const zod_1 = __importDefault(require("zod"));
const error_response_1 = require("../utils/response/error.response");
const mongoose_1 = require("mongoose");
const validation = (schema) => {
    return (req, res, next) => {
        const reqKey = ["body", "params", "query", "headers"];
        const validationErrors = [];
        for (const key of reqKey) {
            if (schema[key]) {
                const result = schema[key].safeParse(req[key]);
                console.log(result);
                if (!result.success) {
                    const issues = result.error?.issues?.map((issue) => ({
                        path: issue.path,
                        message: issue.message,
                    }));
                    validationErrors.push({ key, issues });
                }
            }
        }
        if (validationErrors.length) {
            throw new error_response_1.BadRequestException("Validation failed", { validationErrors });
        }
        next();
    };
};
exports.validation = validation;
exports.generalFields = {
    userName: zod_1.default
        .string({ error: "User Name is required" })
        .min(2, { error: "Min User Name is 2 Char" })
        .max(20, { error: "Max User Name is 20 Char" }),
    email: zod_1.default.email(),
    password: zod_1.default
        .string()
        .regex(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/),
    confirmPassword: zod_1.default.string(),
    otp: zod_1.default.string().regex(/^\d{6}$/),
    phone: zod_1.default
        .string()
        .regex(/^[0-9]{11}$/, "Phone must be 11 digits")
        .optional(),
    bio: zod_1.default.string().max(200, "Bio can't exceed 200 characters").optional(),
    twoStepEnabled: zod_1.default.boolean().default(false),
    twoStepSecret: zod_1.default.string().optional(),
    twoStepVerifiedAt: zod_1.default.date().optional(),
    file: function (mimetype) {
        return zod_1.default
            .strictObject({
            fieldname: zod_1.default.string(),
            originalname: zod_1.default.string(),
            encoding: zod_1.default.string(),
            mimetype: zod_1.default.enum(mimetype),
            buffer: zod_1.default.any().optional(),
            path: zod_1.default.string().optional(),
            size: zod_1.default.number(),
        })
            .refine((data) => {
            return data.buffer || data.path;
        }, {
            error: "neither path or buffer is available",
            path: ["file"],
        });
    },
    id: zod_1.default.string().refine((data) => {
        return mongoose_1.Types.ObjectId.isValid(data);
    }, {
        error: "In-Valid ObjectId Format",
    }),
};
