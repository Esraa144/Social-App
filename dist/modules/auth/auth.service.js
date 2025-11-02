"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const user_model_1 = require("../../DB/model/user.model");
const error_response_1 = require("../../utils/response/error.response");
const hash_security_1 = require("../../utils/security/hash.security");
const email_event_1 = require("../../utils/email/email.event");
const otp_1 = require("../../utils/otp");
const token_security_1 = require("../../utils/security/token.security");
const google_auth_library_1 = require("google-auth-library");
const success_response_1 = require("../../utils/response/success.response");
const repository_1 = require("../../DB/repository");
const mongoose_1 = require("mongoose");
const nanoid_1 = require("nanoid");
const nanoid = (0, nanoid_1.customAlphabet)("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 32);
class AuthenticationService {
    userModel = new repository_1.UserRepository(user_model_1.UserModel);
    constructor() { }
    async verifyGmailAccount(idToken) {
        const client = new google_auth_library_1.OAuth2Client();
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.WEB_CLIENT_IDS?.split(",") || [],
        });
        const payload = ticket.getPayload();
        if (!payload?.email_verified) {
            throw new error_response_1.BadRequestException("Fail to verify this google account");
        }
        return payload;
    }
    signupWithGmail = async (req, res) => {
        const { idToken } = req.body;
        const { email, family_name, given_name, picture } = await this.verifyGmailAccount(idToken);
        const user = await this.userModel.findOne({
            filter: {
                email,
            },
        });
        if (user) {
            if (user.provider === user_model_1.ProviderEnum.GOOGLE) {
                return await this.loginWithGmail(req, res);
            }
            throw new error_response_1.ConflictException(`Email exist with another provider :${user.provider}`);
        }
        const [newUser] = (await this.userModel.create({
            data: [
                {
                    firstName: given_name,
                    lastName: family_name,
                    email: email,
                    profilePicture: picture,
                    confirmedAt: new Date(),
                    provider: user_model_1.ProviderEnum.GOOGLE,
                },
            ],
        })) || [];
        if (!newUser) {
            throw new error_response_1.BadRequestException("Fail to signup gmail please try again later");
        }
        const credentials = await (0, token_security_1.createLoginCredentials)(newUser);
        return (0, success_response_1.successResponse)({
            res,
            statusCode: 201,
            data: { credentials },
        });
    };
    loginWithGmail = async (req, res) => {
        const { idToken } = req.body;
        const { email } = await this.verifyGmailAccount(idToken);
        const user = await this.userModel.findOne({
            filter: {
                email,
                provider: user_model_1.ProviderEnum.GOOGLE,
            },
        });
        if (!user) {
            throw new error_response_1.NotFoundException("Not register account or register with another provider");
        }
        const credentials = await (0, token_security_1.createLoginCredentials)(user);
        return (0, success_response_1.successResponse)({ res, data: { credentials } });
    };
    signup = async (req, res) => {
        try {
            const { userName, email, password } = req.body;
            console.log({ userName, email, password });
            const checkUserExist = await this.userModel.findOne({
                filter: { email },
                select: "email",
                options: { lean: true },
            });
            if (checkUserExist) {
                throw new error_response_1.ConflictException("Email Exist");
            }
            const otp = (0, otp_1.generateNumberOtp)();
            console.log("Generated OTP:", otp);
            await this.userModel.createUser({
                data: [
                    {
                        userName,
                        email,
                        password,
                        confirmEmailOtp: `${otp}`,
                    },
                ],
                options: { validateBeforeSave: true },
            });
            console.log("User created in DB");
            email_event_1.emailEvent.emit("ConfirmEmail", { to: email, otp: String(otp) });
            console.log("Email Event Emitted");
            return (0, success_response_1.successResponse)({ res, statusCode: 201 });
        }
        catch (err) {
            console.error(">>> Signup Error:", err.message, err.stack);
            throw err;
        }
    };
    confirmEmail = async (req, res) => {
        const { email, otp } = req.body;
        const user = await this.userModel.findOne({
            filter: {
                email,
                confirmEmailOtp: { $exists: true },
                confirmedAt: { $exists: false },
            },
        });
        if (!user) {
            throw new error_response_1.NotFoundException("In-valid account");
        }
        if (!(await (0, hash_security_1.compareHash)(otp, user.confirmEmailOtp))) {
            throw new error_response_1.ConflictException("In-valid confirmation code");
        }
        await this.userModel.updateOne({
            filter: { email },
            update: {
                confirmedAt: new Date(),
                $unset: { confirmEmailOtp: 1 },
            },
        });
        return (0, success_response_1.successResponse)({ res });
    };
    login = async (req, res) => {
        const { email, password } = req.body;
        const user = await this.userModel.findOne({
            filter: { email, provider: user_model_1.ProviderEnum.SYSTEM },
        });
        if (!user) {
            throw new error_response_1.NotFoundException("In-valid Login Data");
        }
        if (!user.confirmedAt) {
            throw new error_response_1.BadRequestException("Verify your account ");
        }
        if (!(await (0, hash_security_1.compareHash)(password, user.password))) {
            throw new error_response_1.NotFoundException("In-valid Login Data");
        }
        const credentials = await (0, token_security_1.createLoginCredentials)(user);
        return (0, success_response_1.successResponse)({ res, data: { credentials } });
    };
    sendForgotPasswordCode = async (req, res) => {
        const { email } = req.body;
        const user = await this.userModel.findOne({
            filter: {
                email,
                provider: user_model_1.ProviderEnum.SYSTEM,
                confirmedAt: { $exists: true },
            },
        });
        if (!user) {
            throw new error_response_1.NotFoundException("In-valid Account due to one of the following reasons [not register , in-valid provider , not confirmed account]");
        }
        const otp = (0, otp_1.generateNumberOtp)();
        const result = await this.userModel.updateOne({
            filter: { email },
            update: {
                resetPasswordOtp: await (0, hash_security_1.generateHash)(String(otp)),
            },
        });
        if (!result.matchedCount) {
            throw new error_response_1.BadRequestException("Fail to send thr reset code pease try again later");
        }
        email_event_1.emailEvent.emit("resetPassword", { to: email, otp });
        return (0, success_response_1.successResponse)({ res });
    };
    verifyForgotPassword = async (req, res) => {
        const { email, otp } = req.body;
        const user = await this.userModel.findOne({
            filter: {
                email,
                provider: user_model_1.ProviderEnum.SYSTEM,
                resetPasswordOtp: { $exists: true },
            },
        });
        if (!user) {
            throw new error_response_1.NotFoundException("In-valid Account due to one of the following reasons [not register , in-valid provider , not confirmed account]");
        }
        if (!(await (0, hash_security_1.compareHash)(otp, user.resetPasswordOtp))) {
            throw new error_response_1.ConflictException("invalid otp");
        }
        return (0, success_response_1.successResponse)({ res });
    };
    resetForgotPassword = async (req, res) => {
        const { email, otp, password } = req.body;
        const user = await this.userModel.findOne({
            filter: {
                email,
                provider: user_model_1.ProviderEnum.SYSTEM,
                resetPasswordOtp: { $exists: true },
            },
        });
        if (!user) {
            throw new error_response_1.NotFoundException("In-valid Account due to one of the following reasons [not register , in-valid provider , not confirmed account]");
        }
        if (!(await (0, hash_security_1.compareHash)(otp, user.resetPasswordOtp))) {
            throw new error_response_1.ConflictException("invalid otp");
        }
        const result = await this.userModel.updateOne({
            filter: { email },
            update: {
                password: await (0, hash_security_1.generateHash)(password),
                changeCredentialsTime: new Date(),
                $unset: { resetPasswordOtp: 1 },
            },
        });
        if (!result.matchedCount) {
            throw new error_response_1.BadRequestException("Fail to reset account password");
        }
        return (0, success_response_1.successResponse)({ res });
    };
    updatePassword = async (req, res) => {
        const { oldPassword, newPassword, confirmPassword } = req.body;
        const userId = req.user?._id;
        const user = await this.userModel.findById({ id: userId });
        if (!user) {
            throw new error_response_1.NotFoundException("In-valid Account: user not found");
        }
        if (!(await (0, hash_security_1.compareHash)(oldPassword, user.password))) {
            throw new error_response_1.ConflictException("Old password is incorrect");
        }
        if (newPassword !== confirmPassword) {
            throw new error_response_1.BadRequestException("Password mismatch confirm-password");
        }
        const result = await this.userModel.findByIdAndUpdate({
            id: userId,
            update: {
                password: await (0, hash_security_1.generateHash)(newPassword),
                changeCredentialsTime: new Date(),
            },
        });
        if (!result) {
            throw new error_response_1.BadRequestException("Fail to update account password");
        }
        return (0, success_response_1.successResponse)({ res, message: "Password updated successfully" });
    };
    updateInfo = async (req, res) => {
        const { userName, phone, bio } = req.body;
        if (!req.user?._id) {
            throw new error_response_1.BadRequestException("User ID is missing");
        }
        const userId = new mongoose_1.Types.ObjectId(req.user._id);
        const user = await this.userModel.findById({ id: userId });
        if (!user) {
            throw new error_response_1.NotFoundException("In-valid Account: user not found");
        }
        const result = await this.userModel.findByIdAndUpdate({
            id: userId,
            update: {
                ...(userName && { userName }),
                ...(phone && { phone }),
                ...(bio && { bio }),
                changeCredentialsTime: new Date(),
            },
        });
        if (!result) {
            throw new error_response_1.BadRequestException("Fail to update user info");
        }
        return (0, success_response_1.successResponse)({ res, message: "User info updated successfully" });
    };
    enableTwoStep = async (req, res) => {
        const userId = new mongoose_1.Types.ObjectId(req.user?._id);
        const user = await this.userModel.findById({ id: userId });
        if (!user) {
            throw new error_response_1.NotFoundException("Invalid Account: user not found");
        }
        const { twoStepEnabled } = req.body;
        if (twoStepEnabled) {
            const secret = nanoid(32);
            await this.userModel.findByIdAndUpdate({
                id: userId,
                update: {
                    twoStepEnabled: true,
                    twoStepSecret: secret,
                    twoStepVerifiedAt: new Date(),
                },
            });
            return (0, success_response_1.successResponse)({
                res,
                message: "Two-Step Verification enabled successfully",
                data: { secret },
            });
        }
        else {
            await this.userModel.findByIdAndUpdate({
                id: userId,
                update: {
                    twoStepEnabled: false,
                    twoStepSecret: "",
                    twoStepVerifiedAt: null,
                },
            });
            return (0, success_response_1.successResponse)({
                res,
                message: "Two-Step Verification disabled successfully",
            });
        }
    };
}
exports.default = new AuthenticationService();
