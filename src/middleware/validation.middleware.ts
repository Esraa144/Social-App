import { NextFunction, Request, Response } from "express";
import z, { ZodType } from "zod";
import { BadRequestException } from "../utils/response/error.response";
import { Types } from "mongoose";

type RequestKeyType = keyof Request;
type SchemaType = Partial<Record<RequestKeyType, ZodType>>;
type ValidationErrorsType = {
  key: RequestKeyType;
  issues: {
    path: PropertyKey[];
    message: string;
  }[];
};
export const validation = (schema: SchemaType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const reqKey: RequestKeyType[] = ["body", "params", "query", "headers"];
    const validationErrors: ValidationErrorsType[] = [];
    for (const key of reqKey) {
      if (schema[key]) {
        const result = schema[key].safeParse(req[key]);
        // console.log(result);
        if (!result.success) {
          const issues = result.error?.issues?.map((issue) => ({
            path: issue.path,
            message: issue.message,
          }));
          validationErrors.push({ key, issues });
        }
      }
    }
    if (validationErrors.length) {
      throw new BadRequestException("Validation failed", { validationErrors });
    }
    next();
  };
};

export const generalFields = {
  userName: z
    .string({ error: "User Name is required" })
    .min(2, { error: "Min User Name is 2 Char" })
    .max(20, { error: "Max User Name is 20 Char" }),
  email: z.email(),
  password: z
    .string()
    .regex(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/),
  confirmPassword: z.string(),
  otp: z.string().regex(/^\d{6}$/),
  phone: z
    .string()
    .regex(/^[0-9]{11}$/, "Phone must be 11 digits")
    .optional(),
  bio: z.string().max(200, "Bio can't exceed 200 characters").optional(),
  twoStepEnabled: z.boolean().default(false),
  twoStepSecret: z.string().optional(),
  twoStepVerifiedAt: z.date().optional(),

  file: function (mimetype: string[]) {
    return z
      .strictObject({
        fieldname: z.string(),
        originalname: z.string(),
        encoding: z.string(),
        mimetype: z.enum(mimetype),
        buffer: z.any().optional(),
        path: z.string().optional(),
        size: z.number(),
      })
      .refine(
        (data) => {
          return data.buffer || data.path;
        },
        {
          error: "neither path or buffer is available",
          path: ["file"],
        }
      );
  },
  id: z.string().refine(
    (data) => {
      return Types.ObjectId.isValid(data);
    },
    {
      error: "In-Valid ObjectId Format",
    }
  ),
};
