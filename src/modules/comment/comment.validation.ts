import { z } from "zod";

import { generalFields } from "../../middleware/validation.middleware";
import { fileValidation } from "../../utils/multer/cloud.multer";
import { Types } from "mongoose";

export const createComment = {
  params: z.strictObject({ postId: generalFields.id }),
  body: z
    .strictObject({
      content: z.string().min(2).max(500000).optional(),
      attachments: z
        .array(generalFields.file(fileValidation.image))
        .max(2)
        .optional(),

      tags: z.array(generalFields.id).max(10).optional(),
    })
    .superRefine((data, ctx) => {
      if (!data.attachments?.length && !data.content) {
        ctx.addIssue({
          code: "custom",
          path: ["content"],
          message: "sorry we cannot make post without content and attachment",
        });
      }

      if (
        data.tags?.length &&
        data.tags.length !== [...new Set(data.tags)].length
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["tags"],
          message: "Duplicated tagged users",
        });
      }
    }),
};

export const replyOnComment = {
  params: createComment.params.extend({
    commentId: generalFields.id,
  }),
  body: createComment.body,
};

export const freezeComment = {
  params: z
    .object({
      commentId: z.string().optional(),
    })
    .optional()
    .refine(
      (data) => {
        return data?.commentId ? Types.ObjectId.isValid(data.commentId) : true;
      },
      {
        error: "invalid objectId format",
        path: ["commentId"],
      }
    ),
};

export const updateComment = {
  body: z.object({
    content: z.string().min(2).max(500000).optional(),
    attachments: z.array(z.string()).optional(),
  }),
  params: z.object({
    commentId: z.string(),
  }),
}

export const getCommentWithReply = {
  params: z.object({
    commentId: z.string(),
  }).refine(
    (data) => Types.ObjectId.isValid(data.commentId),
    { error: "invalid objectId format", path: ["commentId"] }
  ),
};

