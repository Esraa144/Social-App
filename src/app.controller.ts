//SETUP-ENV
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve("./config/.env.development") });

//LOAD EXPRESS AND EXPRESS TYPE
import type { Express, Request, Response } from "express";
import express from "express";

//THIRD PARTY MIDDLEWARE
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";

//MODULE ROUTING
import { authRouter, initializeIo, postRouter, userRouter } from "./modules";

import { pipeline } from "node:stream";
import { promisify } from "node:util";
import connectDB from "./DB/connection.db";
import {getFile,} from "./utils/multer/s3.config";
import {
  BadRequestException,
  globalErrorHandling,
} from "./utils/response/error.response";
import { chatRouter } from "./modules/chat";
const createS3WriteStreamPipe = promisify(pipeline);

//START-POINT
const bootstrap = async (): Promise<void> => {
  const port: number | string = process.env.PORT || 5000;
  const app: Express = express();

  //HANDEL BASE RATE LIMIT ON ALL API REQUESTS
const limiter = rateLimit({
  windowMs: 60 * 60000,
  limit: 2000,
  message: { error: "Too Many Request please try again later" },
  statusCode: 429,
});

  //GLOBAL MIDDLEWARE
  app.use(cors({ origin: "*" }), express.json(), helmet(), limiter);

  //app-routing
  app.get("/", (req: Request, res: Response) => {
    res.json({ message: "Welcome To Social App Backend Landing Page❤❤ " });
  });
  //sub-app-routing-modules
  app.use("/auth", authRouter);
  app.use("/user", userRouter);
  app.use("/post", postRouter);
  app.use("/chat",chatRouter)
  //get assets

  app.get(
    "/upload/*path",
    async (req: Request, res: Response): Promise<void> => {
      const { path } = req.params as unknown as { path: string[] };
      const Key = path.join("/");
      const s3Response = await getFile({ Key });

      if (!s3Response?.Body) {
        throw new BadRequestException("fail to get file from s3");
      }
      res.set("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Content-Type", s3Response.ContentType as string);
      return await createS3WriteStreamPipe(
        s3Response.Body as NodeJS.ReadableStream,
        res
      );
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
  const httpServer = app.listen(port, () => {
    console.log(`Server Is Running On Port: ${port} 🚀 `);
  });
  initializeIo(httpServer)
};

export default bootstrap;
