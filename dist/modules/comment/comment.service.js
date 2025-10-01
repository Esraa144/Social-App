"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const success_response_1 = require("../../utils/response/success.response");
const repository_1 = require("../../DB/repository");
const model_1 = require("../../DB/model");
const mongoose_1 = require("mongoose");
const post_1 = require("../post");
const error_response_1 = require("../../utils/response/error.response");
const s3_config_1 = require("../../utils/multer/s3.config");
const cloud_multer_1 = require("../../utils/multer/cloud.multer");
class CommentService {
    userModel = new repository_1.UserRepository(model_1.UserModel);
    postModel = new repository_1.PostRepository(model_1.PostModel);
    commentModel = new repository_1.CommentRepository(model_1.CommentModel);
    constructor() { }
    createComment = async (req, res) => {
        const { postId } = req.params;
        const post = await this.postModel.findOne({
            filter: {
                _id: postId,
                allowComments: model_1.AllowCommentsEnum.allow,
                $or: (0, post_1.postAvailability)(req),
            },
        });
        console.log("Post found:", post);
        if (!post) {
            throw new error_response_1.NotFoundException("fail to find matching result");
        }
        if (req.body.tags?.length &&
            (await this.userModel.find({
                filter: { _id: { $in: req.body.tags, $ne: req.user?._id } },
            })).length !== req.body.tags.length) {
            throw new error_response_1.NotFoundException("some of the mentioned user are not exist  ");
        }
        let attachments = [];
        if (req.files?.length) {
            attachments = await (0, s3_config_1.uploadFiles)({
                storageApproach: cloud_multer_1.StorageEnum.memory,
                path: `users/${post.createdBy}/post/${post.assetsFolderId}`,
                files: req.files,
            });
        }
        const [comment] = (await this.commentModel.create({
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
                await (0, s3_config_1.deleteFiles)({ urls: attachments });
            }
            throw new error_response_1.BadRequestException("Fail to create this comment");
        }
        return (0, success_response_1.successResponse)({ res, statusCode: 201 });
    };
    replyOnComment = async (req, res) => {
        const { postId, commentId } = req.params;
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
                            allowComments: model_1.AllowCommentsEnum.allow,
                            $or: (0, post_1.postAvailability)(req),
                        },
                    },
                ],
            },
        });
        console.log({ comment });
        if (!comment?.postId) {
            throw new error_response_1.NotFoundException("fail to find matching result");
        }
        if (req.body.tags?.length &&
            (await this.userModel.find({
                filter: { _id: { $in: req.body.tags, $ne: req.user?._id } },
            })).length !== req.body.tags.length) {
            throw new error_response_1.NotFoundException("some of the mentioned user are not exist  ");
        }
        let attachments = [];
        if (req.files?.length) {
            const post = comment.postId;
            attachments = await (0, s3_config_1.uploadFiles)({
                storageApproach: cloud_multer_1.StorageEnum.memory,
                files: req.files,
                path: `users/${post.createdBy}/post/${post.assetsFolderId}`,
            });
        }
        const [reply] = (await this.commentModel.create({
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
                await (0, s3_config_1.deleteFiles)({ urls: attachments });
            }
            throw new error_response_1.BadRequestException("Fail to create this reply");
        }
        return (0, success_response_1.successResponse)({ res, statusCode: 201 });
    };
    freezeComment = async (req, res) => {
        const { commentId } = req.params || {};
        if (commentId && req.user?.role !== model_1.RoleEnum.admin) {
            throw new error_response_1.ForbiddenException("not authorized user");
        }
        if (!commentId)
            throw new error_response_1.NotFoundException("commentId is required");
        const comment = await this.commentModel.updateOne({
            filter: {
                _id: new mongoose_1.Types.ObjectId(commentId),
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
            throw new error_response_1.NotFoundException("comment not found or fail to freeze");
        }
        return (0, success_response_1.successResponse)({ res });
    };
    hardDeleteComment = async (req, res) => {
        const { commentId } = req.params || {};
        if (!commentId)
            throw new error_response_1.NotFoundException("commentId is required");
        const deleted = await this.commentModel.deleteOne({
            filter: { id: new mongoose_1.Types.ObjectId(commentId) },
        });
        if (!deleted.deletedCount) {
            throw new error_response_1.NotFoundException("comment not found or fail to delete");
        }
        return (0, success_response_1.successResponse)({ res });
    };
    updateComment = async (req, res) => {
        const { commentId } = req.params;
        const updateData = req.body;
        const targetCommentId = new mongoose_1.Types.ObjectId(commentId);
        const comment = await this.commentModel.findById({ id: targetCommentId });
        if (!comment)
            throw new error_response_1.NotFoundException("comment not found");
        const commentOwnerId = comment.createdBy.toString();
        if (req.user?.role !== model_1.RoleEnum.admin &&
            commentOwnerId !== req.user?._id.toString()) {
            throw new error_response_1.ForbiddenException("not authorized user");
        }
        const updated = await this.commentModel.findByIdAndUpdate({
            id: targetCommentId,
            update: updateData,
            options: { new: true },
        });
        return (0, success_response_1.successResponse)({ res, data: updated });
    };
    getCommentWithReply = async (req, res) => {
        const { commentId } = req.params;
        const comment = await this.commentModel.findById({
            id: new mongoose_1.Types.ObjectId(commentId),
        });
        if (!comment)
            throw new error_response_1.NotFoundException("Comment not found");
        const replies = await this.commentModel.find({
            filter: { commentId: comment._id },
        });
        return (0, success_response_1.successResponse)({ res, data: { ...comment.toObject(), replies } });
    };
}
exports.default = new CommentService();
