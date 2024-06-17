import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import mongoose from "mongoose";

const createTweet = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get data from body and validate the data
  // create tweet using content and owner(user_.id) details
  // validate the tweet
  // return response

  const { content } = req.body;
  if (!content) {
    throw new ApiError(400, "content is required");
  }

  const tweet = await Tweet.create({
    content,
    owner: req.user?._id,
  });
  if (!tweet) {
    throw new ApiError(500, "Tweet creation failed!");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, tweet, "Tweet created successfully!"));
});

const getUserTweets = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get userId from url using params
  // validate userId using isValidateObjectId
  //start with Tweet aggregation.

  const { userId } = req.params;
  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid userId");
  }

  //Aggregation flow:
  //intialize aggregation pipeline 'Tweet'
  // filter tweets by user
  // lookup to user Details
  // lookup Like details
  // add fields
  // sort by creation time
  // project final fields
  // return aggr result
  const tweets = await Tweet.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline: [
          {
            $project: {
              username: 1,
              "avatar.url": 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "tweet",
        as: "likeDetails",
        pipeline: [
          {
            $project: {
              likedBy: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        likesCount: {
          $size: "$likeDetails",
        },
        ownerDetails: {
          $first: "$ownerDetails",
        },
        isLiked: {
          $cond: {
            if: { $in: [req.user?._id, "$likeDetails.likedBy"] },
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
        ownerDetails: 1,
        likesCount: 1,
        createdAt: 1,
        isLiked: 1,
      },
    },
  ]);
});

const updateTweet = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get data from body and url params, validate the data you got
  // using tweetId find the tweet in Tweet mongoose model, validate the tweet
  // check whether req-sending user and current authenticated user are same or not, if not same, return error.
  // if same, create newTweet variable and using tweetId find the tweet from Tweet mongoose model
  // now replace the old content with new content.
  // validate the newTweet
  // return response

  const { content } = req.body;
  const { tweetId } = req.params;
  if (!content) {
    throw new ApiError(400, "content is required");
  }
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "invalid tweetId");
  }

  const tweet = await Tweet.findById(tweetId);
  if (!tweet) {
    throw new ApiError(404, "tweet not found");
  }

  if (tweet?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(400, "only owner can edit their tweet");
  }

  const newTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    {
      $set: {
        content,
      },
    },
    { new: true }
  );
  if (!newTweet) {
    throw new ApiError(500, "tweet updation failed!");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, newTweet, "Tweet updated successfully!"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get data from url params and validate the data
  // find tweet using tweetId and validate the tweet
  // check whether req-sending user and current authenticated user are same or not, if not throw an error
  // if same, find tweet by tweetId and delete it
  // return response.

  const { tweetId } = req.params;
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweetId");
  }

  const tweet = await Tweet.findById(tweetId);

  if (!tweet) {
    throw new ApiError(404, "Tweet not found");
  }

  if (tweet?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(400, "only owner can delete their tweet");
  }
  await Tweet.findByIdAndDelete(tweetId);

  return res
    .status(200)
    .json(new ApiResponse(200, { tweetId }, "tweet deletion successfull"));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
