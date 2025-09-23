//SETUP-ENV
import { resolve } from "node:path";
import { config } from "dotenv";
config({ path: resolve("./config/.env.development") });

//LOAD EXPRESS AND EXPRESS TYPE
import type { Request, Response, Express } from "express";
import express from "express";

//THIRD PARTY MIDDLEWARE
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

//MODULE ROUTING
import { authRouter, postRouter, userRouter } from "./modules";

import {
  BadRequestException,
  globalErrorHandling,
} from "./utils/response/error.response";
import connectDB from "./DB/connection.db";
import {
  createGetPreSignedLink,
  //  deleteFile,
  // deleteFiles,
  // deleteFolderByPrefix,
  getFile,
} from "./utils/multer/s3.config";
import { promisify } from "node:util";
import { pipeline } from "node:stream";
const createS3WriteStreamPipe = promisify(pipeline);

//HANDEL BASE RATE LIMIT ON ALL API REQUESTS
const limiter = rateLimit({
  windowMs: 60 * 60000,
  limit: 2000,
  message: { error: "Too Many Request please try again later" },
  statusCode: 429,
});

//START-POINT
const bootstrap = async (): Promise<void> => {
  const port: number | string = process.env.PORT || 5000;
  const app: Express = express();

  //GLOBAL MIDDLEWARE
  app.use(cors(), express.json(), helmet(), limiter);

  //app-routing
  app.get("/", (req: Request, res: Response) => {
    res.json({ message: "Welcome To Social App Backend Landing Page❤❤ " });
  });
  //sub-app-routing-modules
  app.use("/auth", authRouter);
  app.use("/user", userRouter);
  app.use("/post", postRouter);
  //get assets
  app.get(
    "/upload/*path",
    async (req: Request, res: Response): Promise<void> => {
      const { downloadName, download = "false" } = req.query as {
        downloadName?: string;
        download?: string;
      };
      const { path } = req.params as unknown as { path: string[] };
      const Key = path.join("/");
      const s3Response = await getFile({ Key });
      console.log(s3Response.Body);
      if (!s3Response?.Body) {
        throw new BadRequestException("fail to fetch this asset");
      }
      res.setHeader(
        "Content-type",
        `${s3Response.ContentType || "application/octet-stream"}`
      );

      if (download === "true") {
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${downloadName || Key.split("/").pop()}"`
        );
      }
      return await createS3WriteStreamPipe(
        s3Response.Body as NodeJS.ReadableStream,
        res
      );
    }
  );

  app.get(
    "/upload/pre-signed/*path",
    async (req: Request, res: Response): Promise<Response> => {
      const {
        downloadName,
        download = "false",
        expiresIn = 120,
      } = req.query as {
        downloadName?: string;
        download?: string;
        expiresIn?: number;
      };
      const { path } = req.params as unknown as { path: string[] };
      const Key = path.join("/");
      const url = await createGetPreSignedLink({
        Key,
        downloadName: downloadName as string,
        download,
        expiresIn,
      });
      return res.json({ message: "Done", data: { url } });
    }
  );

  //IN-VALID ROUTING
  app.use("{/*dummy}", (req: Request, res: Response) => {
    return res.status(404).json({
      message: "In-Valid app routing please check you method or your URL❌",
    });
  });

  //GLOBAL ERROR HANDLE
  app.use(globalErrorHandling);

  //DB
  await connectDB();

  //START SERVER
  app.listen(port, () => {
    console.log(`Server Is Running On Port: ${port} 🚀 `);
  });
};

export default bootstrap;
