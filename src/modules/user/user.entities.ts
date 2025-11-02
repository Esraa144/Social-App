import { HChatDocument } from "../../DB/model";
import { HUserDocument } from "../../DB/model/user.model";

export interface IProfileImageResponse {
  url: string;
}

export interface IUserResponse {
  user: Partial<HUserDocument>;
  groups?:Partial<HChatDocument>[];
}
