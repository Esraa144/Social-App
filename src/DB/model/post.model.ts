import { HydratedDocument, model, models, Schema, Types } from "mongoose";

export enum AllowCommentsEnum {
  allow = "allow",
  deny = "deny",
}

export enum AvailabilityEnum {
  public = "public",
  friends = "friends",
  onlyMe = "onlyMe",
}

export enum LikeActionEnum {
  like = "like",
  unlike = "unlike",
}

export interface IPost {
  content?: string;
  attachments?: string[];
  assetsFolderId: string;

  availability: AvailabilityEnum;
  allowComments: AllowCommentsEnum;

  likes?: Types.ObjectId[];
  tags?: Types.ObjectId[];

  createdBy: Types.ObjectId;

  freezedAt?: Date;
  freezedBy?: Types.ObjectId;

  restoredAt?: Date;
  restoredBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt?: Date;
}

export type HPostDocument = HydratedDocument<IPost>;

const postSchema = new Schema<IPost>(
  {
    content: {
      type: String,
      minlength: 2,
      maxlength: 500000,
      required: function () {
        return !this.attachments?.length;
      },
    },
    attachments: [String],
    assetsFolderId: { type: String, required: true },
    availability: {
      type: String,
      enum: AvailabilityEnum,
      default: AvailabilityEnum.public,
    },

    allowComments: {
      type: String,
      enum: AllowCommentsEnum,
      default: AllowCommentsEnum.allow,
    },
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    tags: [{ type: Schema.Types.ObjectId, ref: "User" }],

    createdBy: { type: Schema.Types.ObjectId, ref: "User" },

    freezedAt: Date,
    freezedBy: { type: Schema.Types.ObjectId, ref: "User" },

    restoredAt: Date,
    restoredBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    strictQuery: true,
  }
);

postSchema.pre(["findOneAndUpdate", "updateOne"], function (next) {
  const query = this.getQuery();
  if (query.paranoid === false) {
    this.setQuery({ ...query });
  } else {
    this.setQuery({ ...query, freezedAt: { $exists: false } });
  }
  next();
});
export const PostModel = models.Post || model<IPost>("Post", postSchema);
