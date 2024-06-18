import mongoose, { isValidObjectId } from "mongoose";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "..utils/ApiResponse.js";
import { Subscription } from "../models/subscription.model.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get data channelId from url params and validate the data
  // check whether subscription associated with this user and channel id already exists or not.
  // if exists, then find it by id and delete it, if not exists proceed further
  // create a new subscription with user id and channel id
  // return response

  const { channelId } = req.params;
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channelId");
  }

  const isSubscribed = await Subscription.findOne({
    subscriber: req.user?._id,
    channel: channelId,
  });

  if (isSubscribed) {
    await Subscription.findByIdAndDelete(isSubscribed?._id);

    return res
      .status(200)
      .json(
        new ApiResponse(200, { subscribed: false }, "unsubscribed successfully")
      );
  }

  await Subscription.create({
    subscriber: req.user?._id,
    channel: channelId,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, { subscribed: true }, "subscribed successfully")
    );
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get data from url params and validate it
  // covert channelId string to mongoose ObjectId type
  // perform aggregation on subscription mongoose model
  // return response

  const { channelId } = req.params;
  if (isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channelId");
  }

  channelId = new mongoose.Types.ObjectId(channelId);

  const subscribers = await Subscription.aggregate([
    // Aggregation Workflow:
    // filter out docs where channel field matches with the channelId
    // lookup to user details
    // for each matched subscription,join with "users" collection where _id matches subscriber field in subscription
    // for each matched user, perform another lookup to find subscriptions, where user's _id matches channel field in subscription collection.
    // Add fields
    // subscriberToSubscriber --> indicates whether channelId is in user's subscriptionToSubscriber.subscriber list
    // count of subscriptionToSubscriber's document in array
    // unwind/ flatten the 'subscriber' array to output one document per user
    // project final fields

    {
      $match: {
        channel: channelId,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriber",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribedToSubscriber",
            },
          },
          {
            $addFields: {
              subscribedToSubscriber: {
                $cond: {
                  if: {
                    $in: [channelId, "$subscribedToSubscriber.subscriber"],
                  },
                  then: true,
                  else: false,
                },
              },
              subscribersCount: {
                $size: "$subscibedToSubscriber",
              },
            },
          },
        ],
      },
    },
    {
      $unwind: "$subscriber",
    },
    {
      $project: {
        _id: 0,
        subscriber: {
          _id: 1,
          username: 1,
          fullName: 1,
          "avatar.url": 1,
          subscriberToSubscriber: 1,
          subscribersCount: 1,
        },
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(200, subscribers, "subscribers fetched successfully!")
    );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get data from url params
  // perform aggregation on subscription model
  // return response.
  const { subscriberId } = req.params;

  const subscribedChannels = await Subscription.aggregate([
    // Aggregation Flow:
    // filter subscriptions where subscriber field equals subscriberId
    // lookup to subscribed channels:
    // for each matched subscription, join with user collection where user id matches channel field in subscription
    // for each matched user, perform other lookup, to find videos where user's id matches owner field in video collection.
    // for each user doc found in prev step,add a field latest video which is the last video in videos array.
    // unwind subscribed channel array to output one doc per subscribed channel.
    // project final fields
    {
      $match: {
        subscriber: new mongoose.Types.ObjectId(subscriberId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "subscribedChannel",
        pipeline: [
          {
            $lookup: {
              from: "videos",
              localField: "_id",
              foreignField: "owner",
              as: "videos",
            },
          },
          {
            $addFields: {
              latestVideo: {
                $last: "$videos",
              },
            },
          },
        ],
      },
    },
    {
      $unwind: "$subscribedChannel",
    },
    {
      $project: {
        _id: 0,
        subscribedChannel: {
          _id: 1,
          username: 1,
          fullName: 1,
          "avatar.url": 1,
          latestVideo: {
            _id: 1,
            "videoFile.url": 1,
            "thumbnail.url": 1,
            owner: 1,
            title: 1,
            description: 1,
            duration: 1,
            createdAt: 1,
            views: 1,
          },
        },
      },
    },
  ]);
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subscribedChannels,
        "subscibed channels fetched successfully"
      )
    );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
