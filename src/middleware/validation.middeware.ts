import { z } from "zod";
import type { NextFunction, Request, Response } from "express";
import type { ZodError, ZodType } from "zod";
import { BadRequestException } from "../utils/response/error.response";

type KeyReqType = keyof Request;
type SchemaType = Partial<Record<KeyReqType, ZodType>>;
type validationErrorsType = Array<{
  key: KeyReqType;
  issues: Array<{
    message: string;
    path: string | number | symbol | undefined;
  }>;
}>;
export const validation = (schema: SchemaType) => {
  return (req: Request, res: Response, next: NextFunction): NextFunction => {
    const validationErrors: validationErrorsType = [];

    for (const key of Object.keys(schema) as KeyReqType[]) {
      if (!schema[key]) continue;
      const validationResult = schema[key].safeParse(req[key]);
      if (!validationResult.success) {
        const errors = validationResult.error as ZodError;
        validationErrors.push({
          key,
          issues: errors.issues.map((issue) => {
            return { message: issue.message, path: issue.path[0] };
          }),
        });
      }
    }
    if (validationErrors.length) {
      throw new BadRequestException("Validation Errors", {
        validationErrors,
      });
    }
    return next() as unknown as NextFunction;
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
};
