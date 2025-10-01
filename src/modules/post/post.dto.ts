import { z } from "zod";
import {   deletePost, freezePost, getCommentById, getPostById, likePost, postTags } from "./post.validation";
export type LikePostQueryInputDto = z.infer<typeof likePost.query>;
export type IFreezePostDTO = z.infer<typeof freezePost.params>;
export type IDeletePostDTO = z.infer<typeof deletePost.params>;

export type IPostTagsDTO = z.infer<typeof postTags.body>;
export type IPostTagsParamsDTO = z.infer<typeof postTags.params>;
export type IGetPostByIdDTO = z.infer<typeof getPostById.params>;
export type IGetCommentByIdDTO = z.infer<typeof getCommentById.params>;




