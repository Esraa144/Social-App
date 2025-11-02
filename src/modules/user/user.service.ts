import { Request, Response } from "express";
import {
  IBlockUserDTO,
  IFreezeAccountDTO,
  IHardDeleteAccountDTO,
  ILogoutDto,
  IRestoreAccountDTO,
} from "./user.dto";
import { Types, UpdateQuery } from "mongoose";
import {
  HUserDocument,
  IUser,
  RoleEnum,
  UserModel,
} from "../../DB/model/user.model";
import {
  createLoginCredentials,
  createRevokeToken,
  LogoutEnum,
} from "../../utils/security/token.security";
import { UserRepository } from "../../DB/repository/user.repository ";
// import { TokenRepository } from "../../DB/repository/token.repository";
// import { TokenModel } from "../../DB/model/token.model";
import { JwtPayload } from "jsonwebtoken";
import {
  createPreSignedUploadLink,
  deleteFiles,
  deleteFolderByPrefix,
  uploadFiles,
} from "../../utils/multer/s3.config";
import { StorageEnum } from "../../utils/multer/cloud.multer";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "../../utils/response/error.response";
import { s3Event } from "../../utils/multer/s3.events";
import { successResponse } from "../../utils/response/success.response";
import { IProfileImageResponse, IUserResponse } from "./user.entities";
import { ILoginResponse } from "../auth/auth.entities";
import { ChatRepository, FriendRequestRepository, PostRepository } from "../../DB/repository";
import { ChatModel, FriendRequestModel, PostModel } from "../../DB/model";

class UserService {
  private chatModel:ChatRepository = new ChatRepository(ChatModel);
  private userModel:UserRepository = new UserRepository(UserModel);
  private postModel:PostRepository = new PostRepository(PostModel);
  private friendRequestModel = new FriendRequestRepository(FriendRequestModel);

  //   private tokenModel = new TokenRepository(TokenModel);
  constructor() {}

  profileImage = async (req: Request, res: Response): Promise<Response> => {
    const {
      ContentType,
      originalname,
    }: { ContentType: string; originalname: string } = req.body;
    const { url, key } = await createPreSignedUploadLink({
      ContentType,
      originalname,
      path: `users/${req.decoded?._id}`,
    });
    const user = await this.userModel.findByIdAndUpdate({
      id: req.user?._id as Types.ObjectId,
      update: {
        profilePicture: key,
        temProfileImage: req.user?.profilePicture,
      },
    });
    if (!user) {
      throw new BadRequestException("Fail to update user profile image");
    }

    s3Event.emit("trackProfileImageUpload", {
      userId: req.user?._id,
      oldKey: req.user?.profilePicture,
      key,
      expiresIn: 30000,
    });

    return successResponse<IProfileImageResponse>({ res, data: { url } });
  };

  profileCoverImage = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const urls = await uploadFiles({
      storageApproach: StorageEnum.disk,
      files: req.files as Express.Multer.File[],
      path: `users/${req.decoded?._id}/cover`,
      useLarge: true,
    });
    const user = await this.userModel.findByIdAndUpdate({
      id: req.user?._id as Types.ObjectId,
      update: {
        coverImages: urls,
      },
    });
    if (!user) {
      throw new BadRequestException("Fail to update profile cover images");
    }
    if (req.user?.coverImages) {
      await deleteFiles({ urls: req.user.coverImages });
    }

    return successResponse<IUserResponse>({ res, data: { user } });
  };

  profile = async (req: Request, res: Response): Promise<Response> => {
    const user = await this.userModel.findById({
      id: req.user?._id as Types.ObjectId,
      options: {
        populate: [
          {
            path: "friends",
            select: "firstName lastName email gender profilePicture",
          },
        ],
      },
    });
    if (!user) {
      throw new NotFoundException("fail to find user profile");
    }
    const groups = await this.chatModel.find({
      filter:{
        participants:{$in:req.user?._id as Types.ObjectId},
        group:{$exists:true}
      }
    })
    return successResponse<IUserResponse>({ res, data: { user , groups } });
  };

  dashboard = async (req: Request, res: Response): Promise<Response> => {
    const result = await Promise.allSettled([
      this.userModel.find({ filter: {} }),
      this.postModel.find({ filter: {} }),
    ]);
    return successResponse({ res, data: { result } });
  };

  changeRole = async (req: Request, res: Response): Promise<Response> => {
    const { userId } = req.params as unknown as { userId: Types.ObjectId };
    const { role }: { role: RoleEnum } = req.body;
    const denyRole: RoleEnum[] = [role, RoleEnum.superAdmin];
    if (req.user?.role === RoleEnum.admin) {
      denyRole.push(RoleEnum.admin);
    }
    const user = await this.userModel.findOneAndUpdate({
      filter: {
        _id: userId as Types.ObjectId,
        role: { $nin: denyRole },
      },
      update: {
        role,
      },
    });
    if (!user) {
      throw new NotFoundException("fail to find matching result");
    }
    return successResponse({ res });
  };

  sendFriendRequest = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { userId } = req.params as unknown as { userId: Types.ObjectId };
    const checkFriendRequestExists = await this.friendRequestModel.findOne({
      filter: {
        createdBy: { $in: [req.user?._id, userId] },
        sendTo: { $in: [req.user?._id, userId] },
      },
    });
    if (checkFriendRequestExists) {
      throw new ConflictException("Friend Request Already exists");
    }

    const user = await this.userModel.findOne({ filter: { _id: userId } });
    if (!user) {
      throw new NotFoundException("In-Valid recipient");
    }
    const [friendRequest] =
      (await this.friendRequestModel.create({
        data: [
          {
            createdBy: req.user?._id as Types.ObjectId,
            sendTo: userId,
          },
        ],
      })) || [];

    if (!friendRequest) {
      throw new BadRequestException("Something went wrong!!!!");
    }
    return successResponse({ res });
  };

  acceptFriendRequest = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { requestId } = req.params as unknown as {
      requestId: Types.ObjectId;
    };
    const friendRequest = await this.friendRequestModel.findOneAndUpdate({
      filter: {
        _id: requestId,
        sendTo: req.user?._id,
        acceptedAt: { $exists: false },
      },
      update: {
        acceptedAt: new Date(),
      },
    });
    if (!friendRequest) {
      throw new NotFoundException("Fail to find matching result");
    }

    await Promise.all([
      await this.userModel.updateOne({
        filter: { _id: friendRequest.createdBy },
        update: {
          $addToSet: { friends: friendRequest.sendTo },
        },
      }),
      await this.userModel.updateOne({
        filter: { _id: friendRequest.sendTo },
        update: {
          $addToSet: { friends: friendRequest.createdBy },
        },
      }),
    ]);
    return successResponse({ res });
  };

  freezeAccount = async (req: Request, res: Response): Promise<Response> => {
    const { userId } = (req.params as IFreezeAccountDTO) || {};
    if (userId && req.user?.role !== RoleEnum.admin) {
      throw new ForbiddenException("not authorized user");
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
      throw new NotFoundException(
        "user not found or fail to delete this resource"
      );
    }
    return successResponse({ res });
  };

  restoreAccount = async (req: Request, res: Response): Promise<Response> => {
    const { userId } = req.params as IRestoreAccountDTO;

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
      throw new NotFoundException(
        "user not found or fail to restore this resource"
      );
    }
    return successResponse({ res });
  };

  hardDeleteAccount = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { userId } = req.params as IHardDeleteAccountDTO;

    const user = await this.userModel.deleteOne({
      filter: {
        _id: userId,
        freezedAt: { $exists: true },
      },
    });
    console.log({ user });

    if (!user.deletedCount) {
      throw new NotFoundException(
        "user not found or fail to restore this resource"
      );
    }
    await deleteFolderByPrefix({ path: `users/${userId}` });
    return successResponse({ res });
  };

  logout = async (req: Request, res: Response): Promise<Response> => {
    const { flag }: ILogoutDto = req.body;
    let statusCode: number = 200;
    const update: UpdateQuery<IUser> = {};
    switch (flag) {
      case LogoutEnum.all:
        update.changeCredentialsTime = new Date();
        break;

      default:
        await createRevokeToken(req.decoded as JwtPayload);
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

  refreshToken = async (req: Request, res: Response): Promise<Response> => {
    const credentials = await createLoginCredentials(req.user as HUserDocument);
    await createRevokeToken(req.decoded as JwtPayload);
    return successResponse<ILoginResponse>({
      res,
      statusCode: 201,
      data: { credentials },
    });
  };

  blockUser = async (req: Request, res: Response): Promise<Response> => {
    const { userId } = req.params as IBlockUserDTO;

    if (req.user?.role !== RoleEnum.admin) {
      throw new ForbiddenException("not authorized user");
    }

    const targetUserId = new Types.ObjectId(userId);

    const user = await this.userModel.updateOne({
      filter: { _id: targetUserId, blockedAt: { $exists: false } },
      update: {
        blockedAt: new Date(),
        blockedBy: req.user?._id,
      },
    });

    if (!user.matchedCount) {
      throw new NotFoundException("user not found or already blocked");
    }

    return successResponse({ res });
  };
}

export default new UserService();
