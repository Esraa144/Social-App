"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const user_model_1 = require("../../DB/model/user.model");
const token_security_1 = require("../../utils/security/token.security");
const user_repository_1 = require("../../DB/repository/user.repository ");
const s3_config_1 = require("../../utils/multer/s3.config");
const cloud_multer_1 = require("../../utils/multer/cloud.multer");
const error_response_1 = require("../../utils/response/error.response");
const s3_events_1 = require("../../utils/multer/s3.events");
const success_response_1 = require("../../utils/response/success.response");
class UserService {
    userModel = new user_repository_1.UserRepository(user_model_1.UserModel);
    constructor() { }
    profileImage = async (req, res) => {
        const { ContentType, originalname, } = req.body;
        const { url, key } = await (0, s3_config_1.createPreSignedUploadLink)({
            ContentType,
            originalname,
            path: `users/${req.decoded?._id}`,
        });
        const user = await this.userModel.findByIdAndUpdate({
            id: req.user?._id,
            update: {
                profileImag: key,
                temProfileImage: req.user?.profileImage,
            },
        });
        if (!user) {
            throw new error_response_1.BadRequestException("Fail to update user profile image");
        }
        s3_events_1.s3Event.emit("trackProfileImageUpload", {
            userId: req.user?._id,
            oldKey: req.user?.profileImage,
            key,
            expiresIn: 30000,
        });
        return (0, success_response_1.successResponse)({ res, data: { url } });
    };
    profileCoverImage = async (req, res) => {
        const urls = await (0, s3_config_1.uploadFiles)({
            storageApproach: cloud_multer_1.StorageEnum.disk,
            files: req.files,
            path: `users/${req.decoded?._id}/cover`,
            useLarge: true,
        });
        const user = await this.userModel.findByIdAndUpdate({
            id: req.user?._id,
            update: {
                coverImages: urls,
            },
        });
        if (!user) {
            throw new error_response_1.BadRequestException("Fail to update profile cover images");
        }
        if (req.user?.coverImages) {
            await (0, s3_config_1.deleteFiles)({ urls: req.user.coverImages });
        }
        return (0, success_response_1.successResponse)({ res, data: { user } });
    };
    profile = async (req, res) => {
        if (!req.user) {
            throw new error_response_1.UnauthorizedException("missing user details");
        }
        return (0, success_response_1.successResponse)({ res, data: { user: req.user } });
    };
    freezeAccount = async (req, res) => {
        const { userId } = req.params || {};
        if (userId && req.user?.role !== user_model_1.RoleEnum.admin) {
            throw new error_response_1.ForbiddenException("not authorized user");
        }
        const user = await this.userModel.updateOne({
            filter: {
                _id: userId || req.user?._id,
                freezedAt: { $exists: false },
            },
            update: {
                freezedAt: new Date(),
                freezedBy: req.user?._id,
                changeCredentialsTime: new Date(),
                $unset: {
                    restoredAt: 1,
                    restoredBy: 1,
                },
            },
        });
        if (!user) {
            throw new error_response_1.NotFoundException("user not found or fail to delete this resource");
        }
        return (0, success_response_1.successResponse)({ res });
    };
    restoreAccount = async (req, res) => {
        const { userId } = req.params;
        const user = await this.userModel.updateOne({
            filter: {
                _id: userId,
                freezedBy: { $ne: userId },
            },
            update: {
                restoredAt: new Date(),
                restoredBy: req.user?._id,
                $unset: {
                    freezedAt: 1,
                    freezedBy: 1,
                },
            },
        });
        if (!user.matchedCount) {
            throw new error_response_1.NotFoundException("user not found or fail to restore this resource");
        }
        return (0, success_response_1.successResponse)({ res });
    };
    hardDeleteAccount = async (req, res) => {
        const { userId } = req.params;
        const user = await this.userModel.deleteOne({
            filter: {
                _id: userId,
                freezedAt: { $exists: true },
            },
        });
        console.log({ user });
        if (!user.deletedCount) {
            throw new error_response_1.NotFoundException("user not found or fail to restore this resource");
        }
        await (0, s3_config_1.deleteFolderByPrefix)({ path: `users/${userId}` });
        return (0, success_response_1.successResponse)({ res });
    };
    logout = async (req, res) => {
        const { flag } = req.body;
        let statusCode = 200;
        const update = {};
        switch (flag) {
            case token_security_1.LogoutEnum.all:
                update.changeCredentialsTime = new Date();
                break;
            default:
                await (0, token_security_1.createRevokeToken)(req.decoded);
                statusCode = 201;
                break;
        }
        await this.userModel.updateOne({
            filter: { _id: req.decoded?._id },
            update,
        });
        return res.status(statusCode).json({
            message: "Done",
        });
    };
    refreshToken = async (req, res) => {
        const credentials = await (0, token_security_1.createLoginCredentials)(req.user);
        await (0, token_security_1.createRevokeToken)(req.decoded);
        return (0, success_response_1.successResponse)({
            res,
            statusCode: 201,
            data: { credentials },
        });
    };
}
exports.default = new UserService();
