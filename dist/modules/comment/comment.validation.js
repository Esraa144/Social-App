"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCommentWithReply = exports.updateComment = exports.freezeComment = exports.replyOnComment = exports.createComment = void 0;
const zod_1 = require("zod");
const validation_middleware_1 = require("../../middleware/validation.middleware");
const cloud_multer_1 = require("../../utils/multer/cloud.multer");
const mongoose_1 = require("mongoose");
exports.createComment = {
    params: zod_1.z.strictObject({ postId: validation_middleware_1.generalFields.id }),
    body: zod_1.z
        .strictObject({
        content: zod_1.z.string().min(2).max(500000).optional(),
        attachments: zod_1.z
            .array(validation_middleware_1.generalFields.file(cloud_multer_1.fileValidation.image))
            .max(2)
            .optional(),
        tags: zod_1.z.array(validation_middleware_1.generalFields.id).max(10).optional(),
    })
        .superRefine((data, ctx) => {
        if (!data.attachments?.length && !data.content) {
            ctx.addIssue({
                code: "custom",
                path: ["content"],
                message: "sorry we cannot make post without content and attachment",
            });
        }
        if (data.tags?.length &&
            data.tags.length !== [...new Set(data.tags)].length) {
            ctx.addIssue({
                code: "custom",
                path: ["tags"],
                message: "Duplicated tagged users",
            });
        }
    }),
};
exports.replyOnComment = {
    params: exports.createComment.params.extend({
        commentId: validation_middleware_1.generalFields.id,
    }),
    body: exports.createComment.body,
};
exports.freezeComment = {
    params: zod_1.z
        .object({
        commentId: zod_1.z.string().optional(),
    })
        .optional()
        .refine((data) => {
        return data?.commentId ? mongoose_1.Types.ObjectId.isValid(data.commentId) : true;
    }, {
        error: "invalid objectId format",
        path: ["commentId"],
    }),
};
exports.updateComment = {
    body: zod_1.z.object({
        content: zod_1.z.string().min(2).max(500000).optional(),
        attachments: zod_1.z.array(zod_1.z.string()).optional(),
    }),
    params: zod_1.z.object({
        commentId: zod_1.z.string(),
    }),
};
exports.getCommentWithReply = {
    params: zod_1.z.object({
        commentId: zod_1.z.string(),
    }).refine((data) => mongoose_1.Types.ObjectId.isValid(data.commentId), { error: "invalid objectId format", path: ["commentId"] }),
};
