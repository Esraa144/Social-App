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
import authController from "./modules/auth/auth.controller";
import userController from "./modules/user/user.controller";
import { globalErrorHandling } from "./utils/response/error.response";
import connectDB from "./DB/connection.db";

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
  app.use("/auth", authController);
  app.use("/user", userController);

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
