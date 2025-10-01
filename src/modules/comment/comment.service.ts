import type { Request, Response } from "express";
import { successResponse } from "../../utils/response/success.response";
import {
  CommentRepository,
  PostRepository,
  UserRepository,
} from "../../DB/repository";
import {
  AllowCommentsEnum,
  CommentModel,
  HPostDocument,
  PostModel,
  RoleEnum,
  UserModel,
} from "../../DB/model";
import { Types } from "mongoose";
import { postAvailability } from "../post";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "../../utils/response/error.response";
import { deleteFiles, uploadFiles } from "../../utils/multer/s3.config";
import { StorageEnum } from "../../utils/multer/cloud.multer";
import {
  IFreezeCommentDTO,
  IGetCommentWithReplyDTO,
  IUpdateCommentDTO,
  IUpdateCommentParamsDTO,
} from "./comment.dto";

class CommentService {
  private userModel = new UserRepository(UserModel);
  private postModel = new PostRepository(PostModel);
  private commentModel = new CommentRepository(CommentModel);

  constructor() {}
  createComment = async (req: Request, res: Response): Promise<Response> => {
    const { postId } = req.params as unknown as { postId: Types.ObjectId };
    const post = await this.postModel.findOne({
      filter: {
        _id: postId,
        allowComments: AllowCommentsEnum.allow,
        $or: postAvailability(req),
      },
    });
    console.log("Post found:", post);

    if (!post) {
      throw new NotFoundException("fail to find matching result");
    }
    if (
      req.body.tags?.length &&
      (
        await this.userModel.find({
          filter: { _id: { $in: req.body.tags, $ne: req.user?._id } },
        })
      ).length !== req.body.tags.length
    ) {
      throw new NotFoundException("some of the mentioned user are not exist  ");
    }

    let attachments: string[] = [];

    if (req.files?.length) {
      attachments = await uploadFiles({
        storageApproach: StorageEnum.memory,
        path: `users/${post.createdBy}/post/${post.assetsFolderId}`,
        files: req.files as Express.Multer.File[],
      });
    }
    const [comment] =
      (await this.commentModel.create({
        data: [
          {
            ...req.body,
            attachments,
            postId,
            createdBy: req.user?._id,
          },
        ],
      })) || [];
    if (!comment) {
      if (attachments.length) {
        await deleteFiles({ urls: attachments });
      }
      throw new BadRequestException("Fail to create this comment");
    }
    return successResponse({ res, statusCode: 201 });
  };

  replyOnComment = async (req: Request, res: Response): Promise<Response> => {
    const { postId, commentId } = req.params as unknown as {
      postId: Types.ObjectId;
      commentId: Types.ObjectId;
    };
    const comment = await this.commentModel.findOne({
      filter: {
        _id: commentId,
        postId,
      },
      options: {
        populate: [
          {
            path: "postId",
            match: {
              allowComments: AllowCommentsEnum.allow,
              $or: postAvailability(req),
            },
          },
        ],
      },
    });
    console.log({ comment });

    if (!comment?.postId) {
      throw new NotFoundException("fail to find matching result");
    }
    if (
      req.body.tags?.length &&
      (
        await this.userModel.find({
          filter: { _id: { $in: req.body.tags, $ne: req.user?._id } },
        })
      ).length !== req.body.tags.length
    ) {
      throw new NotFoundException("some of the mentioned user are not exist  ");
    }

    let attachments: string[] = [];

    if (req.files?.length) {
      const post = comment.postId as Partial<HPostDocument>;
      attachments = await uploadFiles({
        storageApproach: StorageEnum.memory,
        files: req.files as Express.Multer.File[],
        path: `users/${post.createdBy}/post/${post.assetsFolderId}`,
      });
    }
    const [reply] =
      (await this.commentModel.create({
        data: [
          {
            ...req.body,
            attachments,
            postId,
            commentId,
            createdBy: req.user?._id,
          },
        ],
      })) || [];
    if (!reply) {
      if (attachments.length) {
        await deleteFiles({ urls: attachments });
      }
      throw new BadRequestException("Fail to create this reply");
    }
    return successResponse({ res, statusCode: 201 });
  };

  freezeComment = async (req: Request, res: Response): Promise<Response> => {
    const { commentId } = (req.params as IFreezeCommentDTO) || {};

    if (commentId && req.user?.role !== RoleEnum.admin) {
      throw new ForbiddenException("not authorized user");
    }

    if (!commentId) throw new NotFoundException("commentId is required");

    const comment = await this.commentModel.updateOne({
      filter: {
        _id: new Types.ObjectId(commentId),
        freezedAt: { $exists: false },
      },
      update: {
        freezedAt: new Date(),
        freezedBy: req.user?._id,
        $unset: {
          restoredAt: 1,
          restoredBy: 1,
        },
      },
    });

    if (!comment.matchedCount) {
      throw new NotFoundException("comment not found or fail to freeze");
    }

    return successResponse({ res });
  };

  hardDeleteComment = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { commentId } = (req.params as IFreezeCommentDTO) || {};

    if (!commentId) throw new NotFoundException("commentId is required");

    const deleted = await this.commentModel.deleteOne({
      filter: { id: new Types.ObjectId(commentId) },
    });

    if (!deleted.deletedCount) {
      throw new NotFoundException("comment not found or fail to delete");
    }

    return successResponse({ res });
  };

  updateComment = async (req: Request, res: Response): Promise<Response> => {
    const { commentId } = req.params as IUpdateCommentParamsDTO;
    const updateData = req.body as IUpdateCommentDTO;

    const targetCommentId = new Types.ObjectId(commentId);

    const comment = await this.commentModel.findById({ id: targetCommentId });
    if (!comment) throw new NotFoundException("comment not found");

    const commentOwnerId = (comment.createdBy as Types.ObjectId).toString();
    if (
      req.user?.role !== RoleEnum.admin &&
      commentOwnerId !== req.user?._id.toString()
    ) {
      throw new ForbiddenException("not authorized user");
    }

    const updated = await this.commentModel.findByIdAndUpdate({
      id: targetCommentId,
      update: updateData,
      options: { new: true },
    });
    return successResponse({ res, data: updated });
  };

  getCommentWithReply = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { commentId } = req.params as IGetCommentWithReplyDTO;

    const comment = await this.commentModel.findById({
      id: new Types.ObjectId(commentId),
    });
    if (!comment) throw new NotFoundException("Comment not found");

    const replies = await this.commentModel.find({
      filter: { commentId: comment._id },
    });

    return successResponse({ res, data: { ...comment.toObject(), replies } });
  };
}

export default new CommentService();
