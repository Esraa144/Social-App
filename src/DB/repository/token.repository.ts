import { Model } from "mongoose";
import { IToken as TDocument } from "../model/token.model";
import { DatabaseRepository } from "./database.repository";

export class TokenRepository extends DatabaseRepository<TDocument> {
  constructor(protected override readonly model: Model<TDocument>) {
    super(model);
  }
}
