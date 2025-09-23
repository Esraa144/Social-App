"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generalFields = exports.validation = void 0;
const zod_1 = require("zod");
const error_response_1 = require("../utils/response/error.response");
const mongoose_1 = require("mongoose");
const validation = (schema) => {
    return (req, res, next) => {
        const validationErrors = [];
        for (const key of Object.keys(schema)) {
            if (!schema[key])
                continue;
            if (!schema.file) {
                req.body.attachment = req.file;
            }
            if (!schema.files) {
                req.body.attachments = req.files;
            }
            const validationResult = schema[key].safeParse(req[key]);
            if (!validationResult.success) {
                const errors = validationResult.error;
                validationErrors.push({
                    key,
                    issues: errors.issues.map((issue) => {
                        return { message: issue.message, path: issue.path };
                    }),
                });
            }
        }
        if (validationErrors.length) {
            throw new error_response_1.BadRequestException("Validation Errors", {
                validationErrors,
            });
        }
        return next();
    };
};
exports.validation = validation;
exports.generalFields = {
    userName: zod_1.z
        .string({ error: "User Name is required" })
        .min(2, { error: "Min User Name is 2 Char" })
        .max(20, { error: "Max User Name is 20 Char" }),
    email: zod_1.z.email(),
    password: zod_1.z
        .string()
        .regex(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/),
    confirmPassword: zod_1.z.string(),
    otp: zod_1.z.string().regex(/^\d{6}$/),
    phone: zod_1.z
        .string()
        .regex(/^[0-9]{11}$/, "Phone must be 11 digits")
        .optional(),
    bio: zod_1.z.string().max(200, "Bio can't exceed 200 characters").optional(),
    twoStepEnabled: zod_1.z.boolean().default(false),
    twoStepSecret: zod_1.z.string().optional(),
    twoStepVerifiedAt: zod_1.z.date().optional(),
    file: function (mimetype) {
        return zod_1.z
            .strictObject({
            fieldname: zod_1.z.string(),
            originalname: zod_1.z.string(),
            encoding: zod_1.z.string(),
            mimetype: zod_1.z.enum(mimetype),
            buffer: zod_1.z.any().optional(),
            path: zod_1.z.string().optional(),
            size: zod_1.z.number(),
        })
            .refine((data) => {
            return data.buffer || data.path;
        }, {
            error: "neither path or buffer is available",
            path: ["file"],
        });
    },
    id: zod_1.z.string().refine((data) => {
        return mongoose_1.Types.ObjectId.isValid(data);
    }, {
        error: "In-Valid ObjectId Format",
    }),
};
