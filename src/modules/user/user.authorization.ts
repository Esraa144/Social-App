import { RoleEnum } from "../../DB/model/user.model";

export const endpoint = {
  profile: [RoleEnum.user, RoleEnum.admin],
  restoreAccount: [RoleEnum.admin],
  hardDelete: [RoleEnum.admin],
  dashboard: [RoleEnum.admin, RoleEnum.superAdmin],
};
