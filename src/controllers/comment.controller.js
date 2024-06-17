import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Video } from "../models/video.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get data from URL and query
  // find video by id in mongoose model
  // validate video
  // Comments aggregate
  // find video by id in $match
  // lookup to users collection for owner details
  // lookup to likes collection for comment details
  // add fields --> likescount, owner, check if current user has liked the comment
  // sort --> most recent comment on top
  // project --> include fields like owner details and content details
  // paginate results obtained from commentsAggregate based on options provided
  // return response

  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "video not found");

  const commentsAggregate = Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $addFields: {
        likesCount: {
          $size: "$likes",
        },
        owner: {
          $first: "$owner",
        },
        isLiked: {
          $cond: {
            if: { $in: [req.user?._id, "$likes.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $project: {
        content: 1,
        createdAt: 1,
        likesCount: 1,
        owner: {
          username: 1,
          fullName: 1,
          "avatar.url": 1,
        },
        isLiked: 1,
      },
    },
  ]);
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };
  const comments = await Comment.aggregatePaginate(commentsAggregate, options);
  return res
    .status(200)
    .json(new ApiResponse(200, comments, "Comments fetched successfully"));
});

const addComment = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get data from url and body and validate
  // find video by videoId and validate
  // create comment with content, videoId, owner and validate
  // return response

  const { videoId } = req.params;
  const { content } = req.body;

  if (!content) {
    throw new ApiError(404, "Content is required");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const comment = await Comment.create({
    content,
    video: videoId,
    owner: req.user?._id,
  });
  if (!comment) {
    throw new ApiError(500, "failed to add comment, please try again");
  }

  return res
    .status(200)
    .json(new ApiResponse(201, comment, "Comment added successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get data from url and body and validate content
  // find comment by commentId in Comment data model and validate
  // check whether user trying to update comment and current authenticated user are same or not, validate
  // if same let the user update, else throw an error.
  // find comment by id and update by replacing old content with new content validate for existence of new content
  // return response

  const { commentId } = req.params;
  const { content } = req.body;
  if (!content) {
    throw new ApiError(400, "content is required");
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  if (comment?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(400, "Only owner can edit their comment!");
  }

  const updateComment = await Comment.findByIdAndUpdate(
    comment?._id,
    {
      $set: { content },
    },
    { new: true }
  );
  if (!updateComment) {
    throw new ApiError(500, "Comment updation failed, try again!");
  }

  res
    .status(200)
    .json(new ApiResponse(200, updatedComment, "Comment edited successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get data from url
  // find comment in Comment mongoose model using commentId and validate
  // find the comment using id and delete if req-sending user and current authenticated user are same, else error..
  // also, delete likes associated with comment and current user.
  // return response
  const { commentId } = req.params;

  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new ApiError(404, "comment not found");
  }

  if (comment?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(400, "Only owner can delete their comment");
  }

  await Comment.findByIdAndDelete(commentId);

  // deleting likes associated with current comment id and user
  await Like.deleteMany({
    comment: commentId,
    likedBy: req.user,
  });

  res
    .status(200)
    .json(new ApiResponse(200, { commentId }, "Comment deleted successfully!"));
});

export { getVideoComments, addComment, updateComment, deleteComment };
