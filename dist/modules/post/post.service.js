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
    constructor() { }
    createPost = async (req, res) => {
        if (req.body.tags?.length &&
            (await this.userModel.find({ filter: { _id: { $in: req.body.tags } } }))
                .length !== req.body.tags.length) {
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
}
exports.postService = new PostService();
