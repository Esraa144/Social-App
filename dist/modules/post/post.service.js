"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postService = exports.postAvailability = void 0;
const success_response_1 = require("../../utils/response/success.response");
const repository_1 = require("../../DB/repository");
const user_model_1 = require("../../DB/model/user.model");
const post_model_1 = require("../../DB/model/post.model");
const error_response_1 = require("../../utils/response/error.response");
const uuid_1 = require("uuid");
const s3_config_1 = require("../../utils/multer/s3.config");
const mongoose_1 = require("mongoose");
const model_1 = require("../../DB/model");
const email_event_1 = require("../../utils/email/email.event");
const postAvailability = (req) => {
    return [
        { availability: post_model_1.AvailabilityEnum.public },
        { availability: post_model_1.AvailabilityEnum.onlyMe, createdBy: req.user?._id },
        {
            availability: post_model_1.AvailabilityEnum.friends,
            createdBy: { $in: [...(req.user?.friends || []), req.user?._id] },
        },
        {
            availability: { $ne: post_model_1.AvailabilityEnum.onlyMe },
            tags: { $in: req.user?._id },
        },
    ];
};
exports.postAvailability = postAvailability;
class PostService {
    userModel = new repository_1.UserRepository(user_model_1.UserModel);
    postModel = new repository_1.PostRepository(post_model_1.PostModel);
    commentModel = new repository_1.CommentRepository(model_1.CommentModel);
    constructor() { }
    createPost = async (req, res) => {
        if (req.body.tags?.length &&
            (await this.userModel.find({
                filter: { _id: { $in: req.body.tags, $ne: req.user?._id } },
            })).length !== req.body.tags.length) {
            throw new error_response_1.NotFoundException("some of the mentioned user are not exist  ");
        }
        let attachments = [];
        let assetsFolderId = (0, uuid_1.v4)();
        if (req.files?.length) {
            attachments = await (0, s3_config_1.uploadFiles)({
                files: req.files,
                path: `users/${req.user?._id}/post/${assetsFolderId}`,
            });
        }
        const [post] = (await this.postModel.create({
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
                await (0, s3_config_1.deleteFiles)({ urls: attachments });
            }
            throw new error_response_1.BadRequestException("Fail to create this post");
        }
        return (0, success_response_1.successResponse)({ res, statusCode: 201 });
    };
    updatePost = async (req, res) => {
        const { postId } = req.params;
        const post = await this.postModel.findOne({
            filter: {
                _id: postId,
                createdBy: req.user?._id,
            },
        });
        if (!post) {
            throw new error_response_1.NotFoundException("fai to find matching result");
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
                files: req.files,
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
                                        (req.body.removedTags || []).map((tag) => {
                                            return mongoose_1.Types.ObjectId.createFromHexString(tag);
                                        }),
                                    ],
                                },
                                (req.body.tags || []).map((tag) => {
                                    return mongoose_1.Types.ObjectId.createFromHexString(tag);
                                }),
                            ],
                        },
                    },
                },
            ],
        });
        if (!updatedPost.matchedCount) {
            if (attachments.length) {
                await (0, s3_config_1.deleteFiles)({ urls: attachments });
            }
            throw new error_response_1.BadRequestException("Fail to create this post");
        }
        else {
            if (req.body.removedAttachments?.length) {
                await (0, s3_config_1.deleteFiles)({ urls: req.body.removedAttachments });
            }
        }
        return (0, success_response_1.successResponse)({ res });
    };
    likePost = async (req, res) => {
        const { postId } = req.params;
        const { action } = req.query;
        let update = {
            $addToSet: { likes: req.user?._id },
        };
        if (action === post_model_1.LikeActionEnum.unlike) {
            update = { $pull: { likes: req.user?._id } };
        }
        const post = await this.postModel.findOneAndUpdate({
            filter: {
                _id: postId,
                $or: (0, exports.postAvailability)(req),
            },
            update,
        });
        if (!post) {
            throw new error_response_1.NotFoundException("In-Valid post Id or post not exist");
        }
        return (0, success_response_1.successResponse)({ res });
    };
    postList = async (req, res) => {
        let { page, size } = req.query;
        const posts = await this.postModel.paginate({
            filter: {
                $or: (0, exports.postAvailability)(req),
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
        return (0, success_response_1.successResponse)({ res, data: { posts } });
    };
    freezePost = async (req, res) => {
        const { postId } = req.params || {};
        if (postId && req.user?.role !== user_model_1.RoleEnum.admin) {
            throw new error_response_1.ForbiddenException("not authorized user");
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
            throw new error_response_1.NotFoundException("post not found or fail to freeze this resource");
        }
        return (0, success_response_1.successResponse)({ res });
    };
    deletePost = async (req, res) => {
        const { postId } = req.params || {};
        if (postId && req.user?.role !== user_model_1.RoleEnum.admin) {
            throw new error_response_1.ForbiddenException("not authorized user");
        }
        const targetPostId = postId ? new mongoose_1.Types.ObjectId(postId) : undefined;
        if (!targetPostId) {
            throw new error_response_1.NotFoundException("postId is required");
        }
        const post = await this.postModel.findById({ id: targetPostId });
        if (!post) {
            throw new error_response_1.NotFoundException("post not found");
        }
        const postOwnerId = post.createdBy.toString();
        if (req.user?.role !== user_model_1.RoleEnum.admin &&
            postOwnerId !== req.user?._id.toString()) {
            throw new error_response_1.ForbiddenException("not authorized user");
        }
        const deleted = await this.postModel.deleteOne({
            filter: { id: targetPostId },
        });
        if (!deleted.deletedCount) {
            throw new error_response_1.NotFoundException("post not found or fail to delete this resource");
        }
        return (0, success_response_1.successResponse)({ res });
    };
    updatePostTags = async (req, res) => {
        const { postId } = req.params;
        const { tags, ...updateData } = req.body;
        const targetPostId = new mongoose_1.Types.ObjectId(postId);
        const post = await this.postModel.findById({ id: targetPostId });
        if (!post)
            throw new Error("post not found");
        const updated = await this.postModel.findByIdAndUpdate({
            id: targetPostId,
            update: { ...updateData, tags },
            options: { new: true },
        });
        if (tags?.length) {
            for (const userId of tags) {
                email_event_1.emailEvent.emit("TagNotification", {
                    to: await this.getUserEmail(userId),
                    subject: "You were tagged!",
                    html: `<p>You were tagged in a post!</p>`,
                });
            }
        }
        return (0, success_response_1.successResponse)({ res, data: updated });
    };
    async getUserEmail(userId) {
        const user = await this.userModel.findById({
            id: new mongoose_1.Types.ObjectId(userId),
        });
        if (!user)
            throw new Error("User not found");
        return user.email;
    }
    getPostById = async (req, res) => {
        const { postId } = req.params;
        const post = await this.postModel.findById({ id: new mongoose_1.Types.ObjectId(postId) });
        if (!post)
            throw new error_response_1.NotFoundException("Post not found");
        if (req.user?.role !== user_model_1.RoleEnum.admin &&
            post.createdBy.toString() !== req.user?._id.toString()) {
            throw new error_response_1.ForbiddenException("not authorized user");
        }
        return (0, success_response_1.successResponse)({ res, data: post });
    };
    getCommentById = async (req, res) => {
        const { commentId } = req.params;
        const comment = await this.commentModel.findById({ id: new mongoose_1.Types.ObjectId(commentId) });
        if (!comment)
            throw new error_response_1.NotFoundException("Comment not found");
        if (req.user?.role !== user_model_1.RoleEnum.admin &&
            comment.createdBy.toString() !== req.user?._id.toString()) {
            throw new error_response_1.ForbiddenException("not authorized user");
        }
        return (0, success_response_1.successResponse)({ res, data: comment });
    };
}
exports.postService = new PostService();
