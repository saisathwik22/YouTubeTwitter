import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

// TODO: Get channel stats like total video views, total subscribers, total videos, total likes etc.
const getChannelStats = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // retrieve user id from current user
  // perform aggregation on subscription model for total subscribers
  // perform aggregation on subscription model for video
  // update channel statistics.
  // return response.
  const userId = req.user?._id;

  const totalSubscribers = await Subscription.aggregate([
    // Aggregation Flow:
    // filter subscriptions where channel matches userid
    // group result into single doc,calculate subscribers count as sum of matched documents and store the result
    {
      $match: {
        channel: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $group: {
        _id: null,
        subscribersCount: {
          $sum: 1,
        },
      },
    },
  ]);

  const video = await Video.aggregate([
    // Aggregation Flow:
    // filter videos where owner matches userid
    // lookup to likes collection to count likes for each video
    // project required fields regarding likes
    // group results in single doc and calculate total views likes and videos
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $project: {
        totalLikes: {
          $size: "$likes",
        },
        totalViews: "$views",
        totalVideos: 1,
      },
    },
    {
      $group: {
        _id: null,
        totalLikes: {
          $sum: "$totalLikes",
        },
        totalViews: {
          $sum: "$totalViews",
        },
        totalVideos: {
          $sum: 1,
        },
      },
    },
  ]);
  const channelStats = {
    totalSubscribers: totalSubscribers[0]?.subscribersCount || 0,
    totalLikes: video[0]?.totalLikes || 0,
    totalViews: video[0]?.totalViews || 0,
    totalVideos: video[0]?.totalVideos || 0,
  };
  return res
    .status(200)
    .json(
      new ApiResponse(200, channelStats, "channel stats fetched successfully")
    );
});

// TODO: Get all videos uploaded by channel
const getChannelVideos = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // retrieve user id from current user
  // perform aggregation on videos
  // return response

  const userId = req.user?._id;

  const videos = await Video.aggregate([
    // Aggregation Flow:
    // filter docs where owner matches with current logged in user
    // lookup to likes to retrieve likes associated with each video
    // add fields --> breakdown createdAt to year, month, day
    // calculate size of likes array to count likes for each video
    // sort docs in descending order based on createdAt
    // project final values

    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $addFields: {
        createdAt: {
          $dateToParts: { date: "$createdAt" },
        },
        likesCount: {
          $size: "$likes",
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
        _id: 1,
        "videoFile.url": 1,
        "thumbnail.url": 1,
        title: 1,
        description: 1,
        createdAt: {
          year: 1,
          month: 1,
          day: 1,
        },
        isPublished: 1,
        likesCount: 1,
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "channel stats fetched successfully"));
});

export { getChannelStats, getChannelVideos };
