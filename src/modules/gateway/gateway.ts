import { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { decodeToken, TokenEnum } from "../../utils/security/token.security";
import { IAuthSocket } from "./gateway.interface";
import { ChatGateway } from "../chat";
import { BadRequestException } from "../../utils/response/error.response";

export const connectedSockets = new Map<string, string>();
let io: undefined | Server = undefined;
export const initializeIo = (httpServer: HttpServer) => {
  //initialize IO
  io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  //middleware
  //listen to =>http://localhost:3000/
  io.use(async (socket: IAuthSocket, next) => {
    try {
      const { user, decoded } = await decodeToken({
        authorization: socket.handshake?.auth.authorization || "",
        tokenType: TokenEnum.access,
      });
      connectedSockets.set(user._id.toString(), socket.id);
      socket.credentials = { user, decoded };
      next();
    } catch (error: any) {
      next(error);
    }
  });

  //disconnection
  function disconnection(socket: IAuthSocket) {
    return socket.on("disconnected", () => {
      const userId = socket.credentials?.user._id?.toString() as string;
      connectedSockets.delete(userId);
      getIo().emit("offline_user", userId);
      console.log(`LogOur From::: ${socket.id}`);
      console.log({ after_Disconnect: connectedSockets });
    });
  }

  //Listen to =>http://localhost:3000/
  const chatGateway: ChatGateway = new ChatGateway();
  io.on("connection", (socket: IAuthSocket) => {
    chatGateway.register(socket, getIo());
    disconnection(socket);
  });
};

export const getIo = (): Server => {
  if (!io) {
    throw new BadRequestException("Fail to stablish server socket Io");
  }
  return io;
};
