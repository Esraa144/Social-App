import type { Request, Response } from "express";
import { successResponse } from "../../utils/response/success.response";
import {
  CommentRepository,
  PostRepository,
  UserRepository,
} from "../../DB/repository";
import { RoleEnum, UserModel } from "../../DB/model/user.model";
import {
  AvailabilityEnum,
  HPostDocument,
  LikeActionEnum,
  PostModel,
} from "../../DB/model/post.model";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "../../utils/response/error.response";
import { v4 as uuid } from "uuid";
import { deleteFiles, uploadFiles } from "../../utils/multer/s3.config";
import {
  IDeletePostDTO,
  IFreezePostDTO,
  IGetCommentByIdDTO,
  IGetPostByIdDTO,
  IPostTagsDTO,
  IPostTagsParamsDTO,
  LikePostQueryInputDto,
} from "./post.dto";
import { Types, UpdateQuery } from "mongoose";
import { CommentModel } from "../../DB/model";
import { emailEvent } from "../../utils/email/email.event";

export const postAvailability = (req: Request) => {
  return [
    { availability: AvailabilityEnum.public },
    { availability: AvailabilityEnum.onlyMe, createdBy: req.user?._id },
    {
      availability: AvailabilityEnum.friends,
      createdBy: { $in: [...(req.user?.friends || []), req.user?._id] },
    },
    {
      availability: { $ne: AvailabilityEnum.onlyMe },
      tags: { $in: req.user?._id },
    },
  ];
};

class PostService {
  private userModel = new UserRepository(UserModel);
  private postModel = new PostRepository(PostModel);
  private commentModel = new CommentRepository(CommentModel);

  constructor() {}

  createPost = async (req: Request, res: Response): Promise<Response> => {
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
    let assetsFolderId: string = uuid();

    if (req.files?.length) {
      attachments = await uploadFiles({
        files: req.files as Express.Multer.File[],
        path: `users/${req.user?._id}/post/${assetsFolderId}`,
      });
    }
    const [post] =
      (await this.postModel.create({
        data: [
          {
            ...req.body,
            attachments,
            assetsFolderId,
            createdBy: req.user?._id,
          },
        ],
      })) || [];
    if (!post) {
      if (attachments.length) {
        await deleteFiles({ urls: attachments });
      }
      throw new BadRequestException("Fail to create this post");
    }
    return successResponse({ res, statusCode: 201 });
  };

  updatePost = async (req: Request, res: Response): Promise<Response> => {
    const { postId } = req.params as unknown as { postId: Types.ObjectId };
    const post = await this.postModel.findOne({
      filter: {
        _id: postId,
        createdBy: req.user?._id,
      },
    });
    if (!post) {
      throw new NotFoundException("fai to find matching result");
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
        files: req.files as Express.Multer.File[],
        path: `users/${post.createdBy}/post/${post.assetsFolderId}`,
      });
    }
    const updatedPost = await this.postModel.updateOne({
      filter: {
        _id: post._id,
      },
      update: [
        {
          $set: {
            content: req.body.content,
            allowComments: req.body.allowComments || post.allowComments,
            availability: req.body.availability || post.availability,
            attachments: {
              $setUnion: [
                {
                  $setDifference: [
                    "$attachments",
                    req.body.removedAttachments || [],
                  ],
                },
                attachments,
              ],
            },

            tags: {
              $setUnion: [
                {
                  $setDifference: [
                    "$tags",
                    (req.body.removedTags || []).map((tag: string) => {
                      return Types.ObjectId.createFromHexString(tag);
                    }),
                  ],
                },
                (req.body.tags || []).map((tag: string) => {
                  return Types.ObjectId.createFromHexString(tag);
                }),
              ],
            },
          },
        },
      ],
    });
    if (!updatedPost.matchedCount) {
      if (attachments.length) {
        await deleteFiles({ urls: attachments });
      }
      throw new BadRequestException("Fail to create this post");
    } else {
      if (req.body.removedAttachments?.length) {
        await deleteFiles({ urls: req.body.removedAttachments });
      }
    }
    return successResponse({ res });
  };

  likePost = async (req: Request, res: Response): Promise<Response> => {
    const { postId } = req.params as { postId: string };
    const { action } = req.query as LikePostQueryInputDto;
    let update: UpdateQuery<HPostDocument> = {
      $addToSet: { likes: req.user?._id },
    };
    if (action === LikeActionEnum.unlike) {
      update = { $pull: { likes: req.user?._id } };
    }
    const post = await this.postModel.findOneAndUpdate({
      filter: {
        _id: postId,
        $or: postAvailability(req),
      },
      update,
    });
    if (!post) {
      throw new NotFoundException("In-Valid post Id or post not exist");
    }
    return successResponse({ res });
  };

  postList = async (req: Request, res: Response): Promise<Response> => {
    let { page, size } = req.query as unknown as {
      page: number;
      size: number;
    };

    const posts = await this.postModel.paginate({
      filter: {
        $or: postAvailability(req),
      },
      options: {
        populate: [
          {
            path: "comments",
            match: {
              commentId: { $exists: false },
              freezedAt: { $exists: false },
            },
            populate: [
              {
                path: "reply",
                match: {
                  commentId: { $exists: false },
                  freezedAt: { $exists: false },
                },
                populate: [
                  {
                    path: "reply",
                    match: {
                      commentId: { $exists: false },
                      freezedAt: { $exists: false },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      page,
      size,
    });

    return successResponse({ res, data: { posts } });
  };

  freezePost = async (req: Request, res: Response): Promise<Response> => {
    const { postId } = (req.params as IFreezePostDTO) || {};

    if (postId && req.user?.role !== RoleEnum.admin) {
      throw new ForbiddenException("not authorized user");
    }
    console.log("REQ USER:", req.user);

    const post = await this.postModel.updateOne({
      filter: { _id: postId, freezedAt: { $exists: false } },
      update: {
        freezedAt: new Date(),
        freezedBy: req.user?._id,
        $unset: {
          restoredAt: 1,
          restoredBy: 1,
        },
      },
    });

    if (!post) {
      throw new NotFoundException(
        "post not found or fail to freeze this resource"
      );
    }

    return successResponse({ res });
  };

  deletePost = async (req: Request, res: Response): Promise<Response> => {
    const { postId } = (req.params as IDeletePostDTO) || {};

    if (postId && req.user?.role !== RoleEnum.admin) {
      throw new ForbiddenException("not authorized user");
    }

    const targetPostId = postId ? new Types.ObjectId(postId) : undefined;

    if (!targetPostId) {
      throw new NotFoundException("postId is required");
    }

    const post = await this.postModel.findById({ id: targetPostId });
    if (!post) {
      throw new NotFoundException("post not found");
    }

    const postOwnerId = (post.createdBy as Types.ObjectId).toString();
    if (
      req.user?.role !== RoleEnum.admin &&
      postOwnerId !== req.user?._id.toString()
    ) {
      throw new ForbiddenException("not authorized user");
    }

    const deleted = await this.postModel.deleteOne({
      filter: { id: targetPostId },
    });
    if (!deleted.deletedCount) {
      throw new NotFoundException(
        "post not found or fail to delete this resource"
      );
    }

    return successResponse({ res });
  };

  updatePostTags = async (req: Request, res: Response): Promise<Response> => {
    const { postId } = req.params as IPostTagsParamsDTO;
    const { tags, ...updateData } = req.body as IPostTagsDTO;

    const targetPostId = new Types.ObjectId(postId);

    const post = await this.postModel.findById({ id: targetPostId });
    if (!post) throw new Error("post not found");

    const updated = await this.postModel.findByIdAndUpdate({
      id: targetPostId,
      update: { ...updateData, tags },
      options: { new: true },
    });
    if (tags?.length) {
      for (const userId of tags) {
        emailEvent.emit("TagNotification", {
          to: await this.getUserEmail(userId),
          subject: "You were tagged!",
          html: `<p>You were tagged in a post!</p>`,
        });
      }
    }

    return successResponse({ res, data: updated });
  };

  private async getUserEmail(userId: string): Promise<string> {
    const user = await this.userModel.findById({
      id: new Types.ObjectId(userId),
    });
    if (!user) throw new Error("User not found");
    return user.email;
  }

    getPostById = async (req: Request, res: Response): Promise<Response> => {
    const { postId } = req.params as IGetPostByIdDTO;

    const post = await this.postModel.findById({id:new Types.ObjectId(postId)});
    if (!post) throw new NotFoundException("Post not found");

    if (
      req.user?.role !== RoleEnum.admin &&
      post.createdBy.toString() !== req.user?._id.toString()
    ) {
      throw new ForbiddenException("not authorized user");
    }

    return successResponse({ res, data: post });
  };

  
  getCommentById = async (req: Request, res: Response): Promise<Response> => {
    const { commentId } = req.params as IGetCommentByIdDTO;

    const comment = await this.commentModel.findById({id:new Types.ObjectId(commentId)});
    if (!comment) throw new NotFoundException("Comment not found");

    if (
      req.user?.role !== RoleEnum.admin &&
      comment.createdBy.toString() !== req.user?._id.toString()
    ) {
      throw new ForbiddenException("not authorized user");
    }

    return successResponse({ res, data: comment });
  };
}

export const postService = new PostService();
