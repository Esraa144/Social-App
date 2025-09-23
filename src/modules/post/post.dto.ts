import { z } from "zod";
import { likePost } from "./post.validation";
export type LikePostQueryInputDto = z.infer<typeof likePost.query>;
