import { Router } from "express";
import { authentication, authorization } from "../../middleware/authentication.middleware";
import {
  cloudFileUpload,
  fileValidation,
} from "../../utils/multer/cloud.multer";
import commentService from "./comment.service";
import * as validators from "./comment.validation";
import { validation } from "../../middleware/validation.middleware";
import { RoleEnum } from "../../DB/model";

const router = Router({ mergeParams: true });
router.post(
  "/",
  authentication(),
  cloudFileUpload({ validation: fileValidation.image }).array("attachments", 2),
  validation(validators.createComment),
  commentService.createComment
);

router.post(
  "/:commentId/reply",
  authentication(),
  cloudFileUpload({ validation: fileValidation.image }).array("attachments", 2),
  validation(validators.replyOnComment),
  commentService.replyOnComment
);



router.patch(
  "/freeze/:commentId",
  authorization([RoleEnum.admin]),
  validation(validators.freezeComment),
  commentService.freezeComment
);

router.delete(
  "/:commentId",
  authorization([RoleEnum.admin]),
  validation(validators.freezeComment),
  commentService.hardDeleteComment
);


router.get(
  "/:commentId/reply",
  authorization([RoleEnum.admin]),
  validation(validators.getCommentWithReply),
  commentService.getCommentWithReply
);

router.patch(
  "/:commentId",
  authorization([RoleEnum.admin]),
  validation(validators.updateComment),
  commentService.updateComment
);
export default router;
