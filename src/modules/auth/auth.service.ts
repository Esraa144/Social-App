import type { Request, Response } from "express";
import type {
  IConfirmEmailBodyInputsDTto,
  IForgotCodeBodyInputsDTto,
  IGmailDTto,
  ILoginBodyInputsDTto,
  IResetForgotCodeDTto,
  ISignupBodyInputsDTto,
  IUpdateInfoDto,
  IUpdatePasswordDto,
  IVerifyForgotCodeDTto,
} from "./auth.dto";
import { ProviderEnum, UserModel } from "../../DB/model/user.model";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "../../utils/response/error.response";
import { compareHash, generateHash } from "../../utils/security/hash.security";
import { emailEvent } from "../../utils/email/email.event";
import { generateNumberOtp } from "../../utils/otp";
import { createLoginCredentials } from "../../utils/security/token.security";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import { successResponse } from "../../utils/response/success.response";
import { ILoginResponse } from "./auth.entities";
import { UserRepository } from "../../DB/repository";
import { Types } from "mongoose";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  32
);

class AuthenticationService {
  private userModel = new UserRepository(UserModel);
  constructor() {}
  private async verifyGmailAccount(idToken: string): Promise<TokenPayload> {
    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.WEB_CLIENT_IDS?.split(",") || [],
    });
    const payload = ticket.getPayload();
    if (!payload?.email_verified) {
      throw new BadRequestException("Fail to verify this google account");
    }
    return payload;
  }
  signupWithGmail = async (req: Request, res: Response): Promise<Response> => {
    const { idToken }: IGmailDTto = req.body;
    const { email, family_name, given_name, picture } =
      await this.verifyGmailAccount(idToken);

    const user = await this.userModel.findOne({
      filter: {
        email,
      },
    });
    if (user) {
      if (user.provider === ProviderEnum.GOOGLE) {
        return await this.loginWithGmail(req, res);
      }
      throw new ConflictException(
        `Email exist with another provider :${user.provider}`
      );
    }

    const [newUser] =
      (await this.userModel.create({
        data: [
          {
            firstName: given_name as string,
            lastName: family_name as string,
            email: email as string,
            profileImage: picture as string,
            confirmedAt: new Date(),
            provider: ProviderEnum.GOOGLE,
          },
        ],
      })) || [];

    if (!newUser) {
      throw new BadRequestException(
        "Fail to signup gmail please try again later"
      );
    }
    const credentials = await createLoginCredentials(newUser);

    return successResponse<ILoginResponse>({
      res,
      statusCode: 201,
      data: { credentials },
    });
  };

  loginWithGmail = async (req: Request, res: Response): Promise<Response> => {
    const { idToken }: IGmailDTto = req.body;
    const { email } = await this.verifyGmailAccount(idToken);

    const user = await this.userModel.findOne({
      filter: {
        email,
        provider: ProviderEnum.GOOGLE,
      },
    });
    if (!user) {
      throw new NotFoundException(
        "Not register account or register with another provider"
      );
    }
    const credentials = await createLoginCredentials(user);

    return successResponse<ILoginResponse>({ res, data: { credentials } });
  };
  /**
   *
   * @param req -Express.Request
   * @param res -Express.Response
   * @returns   Promise<Response>
   * @example( { userName, email, password }: ISignupBodyInputsDto)
   * return{message:"Done",StatusCode:201}
   */
  signup = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { userName, email, password }: ISignupBodyInputsDTto = req.body;
      console.log({ userName, email, password });

      const checkUserExist = await this.userModel.findOne({
        filter: { email },
        select: "email",
        options: { lean: true },
      });
      if (checkUserExist) {
        throw new ConflictException("Email Exist");
      }

      const otp = generateNumberOtp();
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

      emailEvent.emit("ConfirmEmail", { to: email, otp: String(otp) });
      console.log("Email Event Emitted");
      return successResponse({ res, statusCode: 201 });
    } catch (err: any) {
      console.error(">>> Signup Error:", err.message, err.stack);
      throw err;
    }
  };

  confirmEmail = async (req: Request, res: Response): Promise<Response> => {
    const { email, otp }: IConfirmEmailBodyInputsDTto = req.body;
    const user = await this.userModel.findOne({
      filter: {
        email,
        confirmEmailOtp: { $exists: true },
        confirmedAt: { $exists: false },
      },
    });
    if (!user) {
      throw new NotFoundException("In-valid account");
    }
    if (!(await compareHash(otp, user.confirmEmailOtp as string))) {
      throw new ConflictException("In-valid confirmation code");
    }
    await this.userModel.updateOne({
      filter: { email },
      update: {
        confirmedAt: new Date(),
        $unset: { confirmEmailOtp: 1 },
      },
    });
    return successResponse({ res });
  };

  login = async (req: Request, res: Response): Promise<Response> => {
    const { email, password }: ILoginBodyInputsDTto = req.body;
    const user = await this.userModel.findOne({
      filter: { email, provider: ProviderEnum.SYSTEM },
    });
    if (!user) {
      throw new NotFoundException("In-valid Login Data");
    }
    if (!user.confirmedAt) {
      throw new BadRequestException("Verify your account ");
    }
    if (!(await compareHash(password, user.password))) {
      throw new NotFoundException("In-valid Login Data");
    }
    const credentials = await createLoginCredentials(user);

    return successResponse<ILoginResponse>({ res, data: { credentials } });
  };

  sendForgotPasswordCode = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { email }: IForgotCodeBodyInputsDTto = req.body;
    const user = await this.userModel.findOne({
      filter: {
        email,
        provider: ProviderEnum.SYSTEM,
        confirmedAt: { $exists: true },
      },
    });
    if (!user) {
      throw new NotFoundException(
        "In-valid Account due to one of the following reasons [not register , in-valid provider , not confirmed account]"
      );
    }

    const otp = generateNumberOtp();
    const result = await this.userModel.updateOne({
      filter: { email },
      update: {
        resetPasswordOtp: await generateHash(String(otp)),
      },
    });
    if (!result.matchedCount) {
      throw new BadRequestException(
        "Fail to send thr reset code pease try again later"
      );
    }

    emailEvent.emit("resetPassword", { to: email, otp });
    return successResponse({ res });
  };

  verifyForgotPassword = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { email, otp }: IVerifyForgotCodeDTto = req.body;
    const user = await this.userModel.findOne({
      filter: {
        email,
        provider: ProviderEnum.SYSTEM,
        resetPasswordOtp: { $exists: true },
      },
    });
    if (!user) {
      throw new NotFoundException(
        "In-valid Account due to one of the following reasons [not register , in-valid provider , not confirmed account]"
      );
    }

    if (!(await compareHash(otp, user.resetPasswordOtp as string))) {
      throw new ConflictException("invalid otp");
    }
    return successResponse({ res });
  };

  resetForgotPassword = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { email, otp, password }: IResetForgotCodeDTto = req.body;
    const user = await this.userModel.findOne({
      filter: {
        email,
        provider: ProviderEnum.SYSTEM,
        resetPasswordOtp: { $exists: true },
      },
    });
    if (!user) {
      throw new NotFoundException(
        "In-valid Account due to one of the following reasons [not register , in-valid provider , not confirmed account]"
      );
    }

    if (!(await compareHash(otp, user.resetPasswordOtp as string))) {
      throw new ConflictException("invalid otp");
    }

    const result = await this.userModel.updateOne({
      filter: { email },
      update: {
        password: await generateHash(password),
        changeCredentialsTime: new Date(),
        $unset: { resetPasswordOtp: 1 },
      },
    });
    if (!result.matchedCount) {
      throw new BadRequestException("Fail to reset account password");
    }
    return successResponse({ res });
  };

  updatePassword = async (req: Request, res: Response): Promise<Response> => {
    const { oldPassword, newPassword, confirmPassword }: IUpdatePasswordDto =
      req.body;
    const userId = req.user?._id as Types.ObjectId;

    const user = await this.userModel.findById({ id: userId });
    if (!user) {
      throw new NotFoundException("In-valid Account: user not found");
    }

    if (!(await compareHash(oldPassword, user.password))) {
      throw new ConflictException("Old password is incorrect");
    }

    if (newPassword !== confirmPassword) {
      throw new BadRequestException("Password mismatch confirm-password");
    }

    const result = await this.userModel.findByIdAndUpdate({
      id: userId,
      update: {
        password: await generateHash(newPassword),
        changeCredentialsTime: new Date(),
      },
    });

    if (!result) {
      throw new BadRequestException("Fail to update account password");
    }

    return successResponse({ res, message: "Password updated successfully" });
  };

  updateInfo = async (req: Request, res: Response): Promise<Response> => {
    const { userName, phone, bio }: IUpdateInfoDto = req.body;

    if (!req.user?._id) {
      throw new BadRequestException("User ID is missing");
    }
    const userId = new Types.ObjectId(req.user._id);

    const user = await this.userModel.findById({ id: userId });
    if (!user) {
      throw new NotFoundException("In-valid Account: user not found");
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
      throw new BadRequestException("Fail to update user info");
    }

    return successResponse({ res, message: "User info updated successfully" });
  };

  enableTwoStep = async (req: Request, res: Response): Promise<Response> => {
    const userId = new Types.ObjectId(req.user?._id);

    const user = await this.userModel.findById({ id: userId });
    if (!user) {
      throw new NotFoundException("Invalid Account: user not found");
    }

    const { twoStepEnabled }: { twoStepEnabled: boolean } = req.body;

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

      return successResponse({
        res,
        message: "Two-Step Verification enabled successfully",
        data: { secret },
      });
    } else {
      await this.userModel.findByIdAndUpdate({
        id: userId,
        update: {
          twoStepEnabled: false,
          twoStepSecret: "",
          twoStepVerifiedAt: null,
        },
      });

      return successResponse({
        res,
        message: "Two-Step Verification disabled successfully",
      });
    }
  };
}

export default new AuthenticationService();
