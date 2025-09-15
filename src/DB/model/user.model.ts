import { model, models, Schema, HydratedDocument, Types } from "mongoose";

export enum GenderEnum {
  male = "male",
  female = "female",
}

export enum RoleEnum {
  user = "user",
  admin = "admin",
}

export enum ProviderEnum {
  GOOGLE = "GOOGLE",
  SYSTEM = "SYSTEM",
}
export interface IUser {
  //   _id: Types.ObjectId;

  firstName: string;
  lastName: string;
  userName?: string;

  email: string;
  confirmEmailOtp?: string;
  confirmedAt?: Date;

  password: string;
  resetPasswordOtp: string;
  changeCredentialsTime?: Date;

  phone?: string;
  address?: string;
  profileImage?: string;
  temProfileImage?: string;
  coverImages?: string[];

  gender: GenderEnum;
  role: RoleEnum;
  provider: ProviderEnum;

  freezedAt?: Date;
  freezedBy?: Types.ObjectId;
  restoredAt?: Date;
  restoredBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    firstName: { type: String, required: true, minlength: 2, maxlength: 25 },
    lastName: { type: String, required: true, minlength: 2, maxlength: 25 },

    email: { type: String, required: true, unique: true },
    confirmEmailOtp: { type: String },
    confirmedAt: { type: Date },

    password: {
      type: String,
      required: function () {
        return this.provider === ProviderEnum.GOOGLE ? false : true;
      },
    },
    resetPasswordOtp: { type: String },
    changeCredentialsTime: { type: Date },

    phone: { type: String },
    address: { type: String },

    profileImage: { type: String },
    temProfileImage: { type: String },
    coverImages: [String],
    gender: { type: String, enum: GenderEnum, default: GenderEnum.male },
    role: { type: String, enum: RoleEnum, default: RoleEnum.user },

    freezedAt: Date,
    freezedBy: { type: Schema.Types.ObjectId, ref: "User" },
    restoredAt: Date,
    restoredBy: { type: Schema.Types.ObjectId, ref: "User" },

    provider: {
      type: String,
      enum: ProviderEnum,
      default: ProviderEnum.SYSTEM,
    },

    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema
  .virtual("userName")
  .set(function (value: string) {
    const [firstName, lastName] = value.split(" ") || [];
    this.set({ firstName, lastName });
  })
  .get(function () {
    return this.firstName + " " + this.lastName;
  });

export const UserModel = models.User || model<IUser>("User", userSchema);
export type HUserDocument = HydratedDocument<IUser>;
