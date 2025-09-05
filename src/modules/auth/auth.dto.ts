// export interface ISignupBodyInputsDto {
//   userName: string;
//   email: string;
//   password: string;
// }
import * as validators from "./auth.validation";
import { z } from "zod";
export type ISignupBodyInputsDTto = z.infer<typeof validators.signup.body>;
export type IConfirmEmailBodyInputsDTto = z.infer<
  typeof validators.confirmEmail.body
>;
export type ILoginBodyInputsDTto = z.infer<typeof validators.login.body>;
export type IForgotCodeBodyInputsDTto = z.infer<
  typeof validators.sendForgotPasswordCode.body
>;

export type IVerifyForgotCodeDTto = z.infer<
  typeof validators.verifyForgotPassword.body
>;

export type IResetForgotCodeDTto = z.infer<
  typeof validators.resetForgotPassword.body
>;
export type IGmailDTto = z.infer<typeof validators.signupWithGmail.body>;
