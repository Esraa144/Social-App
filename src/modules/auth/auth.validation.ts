import { z } from "zod";
import { generalFields } from "../../middleware/validation.middleware";

export const login = {
  body: z.strictObject({
    email: generalFields.email,
    password: generalFields.password,
  }),
};

export const signup = {
  body: login.body
    .extend({
      userName: generalFields.userName,
      confirmPassword: generalFields.confirmPassword,
    })
    .superRefine((data, ctx) => {
      console.log({ data, ctx });

      if (data.confirmPassword !== data.password) {
        ctx.addIssue({
          code: "custom",
          path: ["confirmEmail"],
          message: "Password mismatch confirmPassword",
        });
      }
    }),
};

export const confirmEmail = {
  body: z.strictObject({
    email: generalFields.email,
    otp: generalFields.otp,
  }),
};

export const signupWithGmail = {
  body: z.strictObject({
    idToken: z.string(),
  }),
};
