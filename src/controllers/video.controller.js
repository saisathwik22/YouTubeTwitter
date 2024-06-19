import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { Comment } from "../models/comment.model.js";
import { uploadOnCloudinary, deleteOnCloudinary } from "../utils/cloudinary.js";
import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";

// get all videos based on query, sort and pagination
const getAllVideos = asyncHandler(async (req, res) => {
  //Functionality Flow:
  // get data and set to default values, create empty array
  //if query provided, add search stage to pipeline to search using title and description
  // validate userid, if not valid --> throw error, if valid --> add match stage to filter videos where owner matches converted userId
  // filter videos which are marked isPublished true
  // if sortBy sortType not given go with default ascending order, else follow as per provided.
  // lookup owner details
  // execute aggregation pipeline
  // define options
  // paginate the results obtained from above aggregation
  // return response
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  console.log(userId);
  const pipeline = [];

  if (query) {
    pipeline.push({
      $search: {
        index: "search-videos",
        text: {
          query: query,
          path: ["title", "description"],
        },
      },
    });
  }

  if (userId) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "Invalid userID");
    }
    pipeline.push({
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    });
  }

  // fetch videos only that are set ispublished true
  pipeline.push({ $match: { isPublished: true } });

  // sortBy can be views, createdAt, duration
  // sortType can be ascending or descending
  if (sortBy && sortType) {
    pipeline.push({
      $sort: {
        [sortBy]: sortType === "asc" ? 1 : -1,
      },
    });
  } else {
    pipeline.push({ $sort: { createdAt: -1 } });
  }

  pipeline.push(
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
      $unwind: "$ownerDetails",
    }
  );

  const videoAggregate = Video.aggregate(pipeline);

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };

  const video = await Video.aggregatePaginate(videoAggregate, options);

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Videos fetched successfully"));
});

// get video, upload to cloudinary, create a video
const publishAVideo = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get data from body, trim the whitespaces and validate
  // retrieve video path and thumbnail paths and validate them
  // upload video and thumbnail file on cloudinary and validate
  // prepare video document
  // find video by id and validate
  // return response

  const { title, description } = req.body;
  if ([title, description].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "all fields are required");
  }

  const videoFileLocalPath = req.files?.videoFile[0].path;
  const thumbnailLocalPath = req.files?.thumbnail[0].path;
  if (!videoFileLocalPath) {
    throw new ApiError(400, "video file local path is required");
  }
  if (!thumbnailLocalPath) {
    throw new ApiError(400, "thumbnail file local path is required");
  }

  const videoFile = await uploadOnCloudinary(videoFileLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
  if (!videoFile) {
    throw new ApiError(400, "Video file not found");
  }
  if (!thumbnail) {
    throw new ApiError(400, "thumbnail file not found");
  }

  const video = await Video.create({
    title,
    description,
    duration: videoFile.duration,
    videoFile: {
      url: videoFile.url,
      public_id: videoFile.public_id,
    },
    thumbnail: {
      url: thumbnail.url,
      public_id: thumbnail.public_id,
    },
    owner: req.user?._id,
    isPublished: false,
  });

  const videoUpload = await Video.findById(video._id);
  if (!videoUpload) {
    throw new ApiError(500, "videoUpload failed please try again!");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video uploaded successfully!"));
});

// get video by id
const getVideoById = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get data from url and validate video id and user id
  // perform aggregation on Video
  // validate video
  // increment views
  // update watch history

  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "invalid video id");
  }
  if (!isValidObjectId(req.user?._id)) {
    throw new ApiError(400, "invalid userid");
  }

  const video = await Video.aggregate([
    // Aggregation Flow:
    // filter docs where video id matches with _id
    // lookup likes
    // lookup owner details
    // addfields and project final fields
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
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
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },
          {
            $addFields: {
              subscriberCount: {
                $size: "$subscribers",
              },
              isSubscribed: {
                $cond: {
                  if: {
                    $in: [req.user?._id, "$subscribers.subscriber"],
                  },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              username: 1,
              "avatar.url": 1,
              subscribersCount: 1,
              isSubscribed: 1,
            },
          },
        ],
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
      $project: {
        "videoFile.url": 1,
        title: 1,
        description: 1,
        views: 1,
        createdAt: 1,
        duration: 1,
        comments: 1,
        owner: 1,
        likesCount: 1,
        isLiked: 1,
      },
    },
  ]);

  if (!video) {
    throw new ApiError(500, "failed to fetch video");
  }
  // increment views if video fetched successfully
  await Video.findByIdAndUpdate(videoId, {
    $inc: {
      views: 1,
    },
  });
  // add this video to user watch history
  await User.findByIdAndUpdate(req.user?._id, {
    $addToSet: {
      watchHistory: videoId,
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, video[0], "video details fetched successfully"));
});

// update video details like title, description, thumbnail
const updateVideo = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get data from body and url params and validate it
  // find video by id and validate, check whether req-sending user and current logged in user same or not, if not then throw error
  // extract public id of thumbnail from video collections
  // validate thumbnail local path
  // upload thumbnailLocalPath on cloudinary and validate
  // find video by id and update with title, desc, and thumbanil details
  // validate the updation
  // if valid, delete the thumbnail from cloudinary
  // return response
  const { title, description } = req.body;
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid videoId");
  }
  if (!(title && description)) {
    throw new ApiError(400, "title  and desc are required");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "no video found");
  }
  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(400, " only owner can update video ");
  }

  // deleting old thumbnail and updating with new one
  const thumbailToDelete = video.thumbnail.public_id;

  const thumbnailLocalPath = req.file?.path;
  if (!thumbnailLocalPath) {
    throw new ApiError(400, "thumbnail is required");
  }
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
  if (!thumbnail) {
    throw new ApiError(400, "thumbnail not found");
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
        thumbnail: {
          public_id: thumbnail.public_id,
          url: thumbnail.url,
        },
      },
    },
    { new: true }
  );
  if (!updatedVideo) {
    throw new ApiError(500, "failed to update video please try again");
  }
  if (updatedVideo) {
    await deleteOnCloudinary(thumbailToDelete);
  }
  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "video updated successfully"));
});

// delete video
const deleteVideo = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get data from url params and validate
  // find video by id and validate, check whether req-seding user and current logged in user is same, if no then throw error
  // find video by id and delete and validate it.
  // use public id of thumbnail and delete from cloudinary
  // use public id of video file and delete from cloudinary
  // delete likes and comments assocaited with the video
  // return response.
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "invalid videoId");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "no video found");
  }
  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(400, "only owner can delete their video");
  }

  const videoDeleted = await Video.findByIdAndDelete(video?._id);
  if (!videoDeleted) {
    throw new ApiError(400, "failed to delete the video please try again!");
  }

  // video model has thumbnail public_id stored in it --> check videoModel
  await deleteOnCloudinary(video.thumbnail.public_id);
  // specify the video while deleting video
  await deleteOnCloudinary(video.videoFile.public_id, "video");

  // delete video Likes
  await Like.deleteMany({
    video: videoId,
  });
  // delete video comments
  await Comment.deleteMany({
    video: videoId,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "video deleted successfully"));
});

// toggle publish status of a video
const togglePublishStatus = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get data from url params and validate
  // find video by id an validate
  // check whether req-sending user and current logged in user are same, if not throw error
  // find video by id and update with videoId and set ispublished with old value.
  // validate toggledVideoPublish
  // return response

  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "invalid videoId");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "video not found");
  }
  if (video.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(400, " only owner can toggle publish status");
  }

  const toggledVideoPublish = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        isPublished: !video?.isPublished,
      },
    },
    { new: true }
  );
  if (!toggledVideoPublish) {
    throw new ApiError(500, "Failed to toggle video publish status");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isPublished: toggledVideoPublish.isPublished },
        "Video publish toggled successfully"
      )
    );
});

export {
  publishAVideo,
  updateVideo,
  deleteVideo,
  getAllVideos,
  getVideoById,
  togglePublishStatus,
};
