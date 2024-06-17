import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Tweet } from "../models/tweet.model";
import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model";

const healthcheck = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, { message: "All O.K" }, "OK"));
});

export { healthcheck };
