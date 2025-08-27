import type { Request, Response } from "express";
import type {
  IConfirmEmailBodyInputsDTto,
  ISignupBodyInputsDTto,
} from "./auth.dto";
import { UserModel } from "../../DB/model/user.model";
import { UserRepository } from "../../DB/repository/user.repository ";
import {
  ConflictException,
  NotFoundException,
} from "../../utils/response/error.response";
import { compareHash, generateHash } from "../../utils/security/hash.security";
import { emailEvent } from "../../utils/event/email.event";
import { generateNumberOtp } from "../../utils/otp";

class AuthenticationService {
  private userModel = new UserRepository(UserModel);
  constructor() {}
  /**
   *
   * @param req -Express.Request
   * @param res -Express.Response
   * @returns   Promise<Response>
   * @example( { userName, email, password }: ISignupBodyInputsDto)
   * return{message:"Done",StatusCode:201}
   */
  signup = async (req: Request, res: Response): Promise<Response> => {
    let { userName, email, password }: ISignupBodyInputsDTto = req.body;
    console.log({ userName, email, password });
    const checkUserExist = await this.userModel.findOne({
      filter: {},
      select: "email",
      options: {
        lean: true,
      },
    });
    console.log(checkUserExist);
    if (checkUserExist) {
      throw new ConflictException("Email Exist");
    }

    const otp = generateNumberOtp();
    const user = await this.userModel.createUser({
      data: [
        {
          userName,
          email,
          password: await generateHash(password),
          confirmEmailOtp: await generateHash(String(otp)),
        },
      ],
    });
    emailEvent.emit("ConfirmEmail", {
      to: email,
      otp: otp,
    });
    return res.status(201).json({ message: "Done", data: { user } });
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
    return res.json({ message: "Done" });
  };

  login = (req: Request, res: Response): Response => {
    return res.json({ message: "Done", data: req.body });
  };
}

export default new AuthenticationService();
