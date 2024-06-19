import { Playlist } from "../models/playlist.model.js";
import { Video } from "../models/video.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import mongoose, { isValidObjectId } from "mongoose";

const createPlaylist = asyncHandler(async (req, res) => {
  //Functionality Flow:
  // get data from body and validate their existance
  // create a playlist from data extracted and validate
  // return response

  const { name, description } = req.body;
  if (!name || !description) {
    throw new ApiError(400, "name and description are required");
  }

  const playlist = await Playlist.create({
    name,
    description,
    owner: req.user?._id,
  });
  if (!playlist) {
    throw new ApiError(500, "failed to create playlist");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "playlist created successfully"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get data from body and url params and validate them
  // find playlist by ID and validate it
  // check whether req-sending user and current logged in user are same or not, if not then throw error
  // playlist found? then update it, set new name and description.
  // return response

  const { name, description } = req.body;
  const { playlistId } = req.params;
  if (!name || !description) {
    throw new ApiError(400, "name and description are required");
  }
  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlistId");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (playlist.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(400, "only owner can edit the playlist");
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlist?._id,
    {
      $set: {
        name,
        description,
      },
    },
    { new: true }
  );
  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedPlaylist, "playlist updated successfully")
    );
});

const deletePlaylist = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get data from url and validate
  // find playlist by id and validate its existence
  // check whether req-sending user and logged in user are same or not, if no throw error
  // find playlist by id and delete
  // return response

  const { playlistId } = req.params;
  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "invalid playlistid");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (playlist.owner.toString() !== req.user?._id.toString) {
    throw new ApiError(400, "Only owner can delete the playlist");
  }

  await Playlist.findByIdAndDelete(playlist?._id);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "playlist updated successfully"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get data from url params and validate them
  // find video and playlist by id and validate
  // check whether req-sending user for both video and playlist matches with logged in user, if no, throw error
  // find playlist by id and update, add videoId to videos collection
  // validate if video added or not
  // return response

  const { playlistId, videoId } = req.params;
  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid playlistId or videoId");
  }

  const playlist = await Playlist.findById(playlistId);
  const video = await Video.findById(videoId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (
    (playlist.owner?.toString() && video.owner?.toString()) !==
    req.user?._id.toString()
  ) {
    throw new ApiError(400, "only onwer can add video to their playlist");
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlist?._id,
    {
      $addToSet: {
        videos: videoId,
      },
    },
    { new: true }
  );

  if (!updatedPlaylist) {
    throw new ApiError(
      400,
      "failed to add video to playlist, please try again!"
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedPlaylist,
        "Added video to playlist successfully"
      )
    );
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get data from url params and validate
  // find playlist and video by id and validate
  // check whether req-sending user and logged in user both are same, if not throw error
  // find playlist by id and update, remove video with the help of videoId
  // return response
  const { playlistId, videoId } = req.params;
  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid playlist id and video id");
  }

  const playlist = await Playlist.findById(playlistId);
  const video = await Video.findById(videoId);
  if (!playlist) {
    throw new ApiError(404, "playlist not found");
  }
  if (!video) {
    throw new ApiError(404, "video not found");
  }

  if (
    (playlist.owner?.toString() && video.owner?.toString()) !==
    req.user?._id.toString()
  ) {
    throw new ApiError(404, "only owner can remove video form their playlist");
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $pull: {
        videos: videoId,
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedPlaylist,
        "Removed video from playlist successfully"
      )
    );
});

const getPlaylistById = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get data from url params and validate
  // find playlist by id and validate
  // perform aggregation on Playlist using playlistId
  // return response
  const { playlistId } = req.params;
  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "invalid playlistid");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  const playlistVideos = await Playlist.aggregate([
    // Aggregation Flow:
    // filter documents where _id matches with playlistId
    // lookup to videos and users
    // addfields
    // project final values
    {
      $match: {
        _id: new mongoose.Types.ObjectId(playlistId),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
      },
    },
    {
      $match: {
        "videos.isPublished": true,
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
      $addFields: {
        totalVideos: {
          $size: "$videos",
        },
        totalViews: {
          $sum: "$videos.views",
        },
        owner: {
          $first: "$owner",
        },
      },
    },
    {
      $project: {
        name: 1,
        description: 1,
        createdAt: 1,
        updatedAt: 1,
        totalVideos: 1,
        totalViews: 1,
        videos: {
          _id: 1,
          "videoFile.url": 1,
          "thumbnail.url": 1,
          title: 1,
          description: 1,
          duration: 1,
          createdAt: 1,
          views: 1,
        },
        owner: {
          username: 1,
          fullName: 1,
          "avatar.url": 1,
        },
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(200, playlistVideos[0], "playlist fetched successfully")
    );
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  // Functionality Flow:
  // get data from url params and validate
  // perform aggregation on playlist
  // return response
  const { userId } = req.params;
  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "invalid userid");
  }

  const playlists = await Playlist.aggregate([
    // Aggregation Flow:
    // filter docs where owner field matches with userId which was converted from string to mongoose objectId
    // lookup to videos collection
    // addFields related to videos
    // project final values
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
      },
    },
    {
      $addFields: {
        totalVideos: {
          $size: "$videos",
        },
        totalViews: {
          $sum: "$videos.views",
        },
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        description: 1,
        totalVideos: 1,
        totalViews: 1,
        updatedAt: 1,
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(200, playlists, "User playlists fetched successfully")
    );
});

export {
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  getPlaylistById,
  getUserPlaylists,
};
