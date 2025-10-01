import { z } from "zod";
import {
  AllowCommentsEnum,
  AvailabilityEnum,
  LikeActionEnum,
} from "../../DB/model/post.model";
import { generalFields } from "../../middleware/validation.middleware";
import { fileValidation } from "../../utils/multer/cloud.multer";
import { Types } from "mongoose";

export const createPost = {
  body: z
    .strictObject({
      content: z.string().min(2).max(500000).optional(),
      attachments: z
        .array(generalFields.file(fileValidation.image))
        .max(2)
        .optional(),
      availability: z.enum(AvailabilityEnum).default(AvailabilityEnum.public),
      allowComments: z.enum(AllowCommentsEnum).default(AllowCommentsEnum.allow),
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

export const updatePost = {
  params: z.strictObject({
    postId: generalFields.id,
  }),
  body: z
    .strictObject({
      content: z.string().min(2).max(500000).optional(),
      attachments: z
        .array(generalFields.file(fileValidation.image))
        .max(2)
        .optional(),
      removedAttachments: z.array(z.string()).max(2).optional(),
      availability: z.enum(AvailabilityEnum).optional(),
      allowComments: z.enum(AllowCommentsEnum).optional(),
      tags: z.array(generalFields.id).max(10).optional(),
      removedTags: z.array(generalFields.id).max(10).optional(),
    })
    .superRefine((data, ctx) => {
      if (!Object.values(data)?.length) {
        ctx.addIssue({
          code: "custom",
          path: ["content"],
          message: "all fields are empty",
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

      if (
        data.removedTags?.length &&
        data.removedTags.length !== [...new Set(data.tags)].length
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["removedTags"],
          message: "Duplicated removedTags users",
        });
      }
    }),
};

export const likePost = {
  params: z.strictObject({
    postId: generalFields.id,
  }),
  query: z.strictObject({
    action: z.enum(LikeActionEnum).default(LikeActionEnum.like),
  }),
};

export const freezePost = {
  params: z
    .object({
      postId: z.string().optional(),
    })
    .optional()
    .refine(
      (data) => {
        return data?.postId ? Types.ObjectId.isValid(data.postId) : true;
      },
      {
        error: "invalid objectId format",
        path: ["postId"],
      }
    ),
};

export const deletePost = {
  params: z
    .object({
      postId: z.string().optional(),
    })
    .optional()
    .refine(
      (data) => {
        return data?.postId ? Types.ObjectId.isValid(data.postId) : true;
      },
      {
        error: "invalid objectId format",
        path: ["postId"],
      }
    ),
};

export const postTags = {
  body: z.object({
    content: z.string().min(2).optional(),
    attachments: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }),
  params: z.object({
    postId: z.string(),
  }),
};


export const getPostById = {
  params: z.object({
    postId: z.string(),
  }).refine(
    (data) => Types.ObjectId.isValid(data.postId),
    { error: "invalid objectId format", path: ["postId"] }
  ),
};

export const getCommentById = {
  params: z.object({
    commentId: z.string(),
  }).refine(
    (data) => Types.ObjectId.isValid(data.commentId),
    { error: "invalid objectId format", path: ["commentId"] }
  ),
};
