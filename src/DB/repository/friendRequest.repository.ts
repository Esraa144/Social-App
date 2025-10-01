import { Model } from "mongoose";
import { IFriendRequest as TDocument } from "../model";
import { DatabaseRepository } from "./database.repository";

export class FriendRequestRepository extends DatabaseRepository<TDocument> {
  constructor(protected override readonly model: Model<TDocument>) {
    super(model);
  }
}
