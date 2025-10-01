import z from "zod";
import { freezeComment, getCommentWithReply, updateComment } from "./comment.validation";

export type IFreezeCommentDTO = z.infer<typeof freezeComment.params>;

export type IUpdateCommentDTO = z.infer<typeof updateComment.body>;
export type IUpdateCommentParamsDTO = z.infer<typeof updateComment.params>;
export type IGetCommentWithReplyDTO = z.infer<typeof getCommentWithReply.params>;


