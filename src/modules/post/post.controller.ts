import { Router } from "express";
import { postService } from "./post.service";
import { authentication, authorization } from "../../middleware/authentication.middleware";
import {
  cloudFileUpload,
  fileValidation,
} from "../../utils/multer/cloud.multer";
import { validation } from "../../middleware/validation.middleware";
import * as validators from "./post.validation";
import { commentRouter } from "../comment";
import { RoleEnum } from "../../DB/model";

const router = Router();
router.use("/:postId/comment", commentRouter);

router.post(
  "/",
  authentication(),
  cloudFileUpload({ validation: fileValidation.image }).array("attachments", 2),
  validation(validators.createPost),
  postService.createPost
);

router.patch("/:postId/tags", validation(validators.postTags), postService.updatePostTags);


router.get(
  "/:postId",
  authorization([RoleEnum.admin]),
  validation(validators.getPostById),
  postService.getPostById
);

router.get(
  "/comment/:commentId",
  authorization([RoleEnum.admin]),
  validation(validators.getCommentById),
  postService.getCommentById
);

router.patch(
  "/:postId/likes",
  authentication(),
  validation(validators.likePost),
  postService.likePost
);

router.patch(
  "/:postId",
  authentication(),
  cloudFileUpload({ validation: fileValidation.image }).array("attachments", 2),
  validation(validators.updatePost),
  postService.updatePost
);


router.delete(
  "/:postId/freeze",
  authentication(),
  validation(validators.freezePost),
  postService.freezePost
);

router.delete(
  "/:postId",
  authorization([RoleEnum.admin]), // الادمن فقط
  validation(validators.deletePost),
  postService.deletePost
);



router.get("/", authentication(), postService.postList);
export default router;
