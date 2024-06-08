import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  // validation - not empty
  // check if user already exists: username, email
  // check for images, check for avatar
  // upload them to cloudinary and ensure avatar uploaded properly
  // create user object - create entry in db
  // remove password and refresh token field from response
  // check for user creation
  // return response

  // get user details from frontend
  const { fullName, email, username, password } = req.body;
  console.log("email: ", email);

  // checking if any of the given fields are empty. - Validation
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // check whether given username or email exists in database already.
  const existedUser = User.findOne({
    $or: [{ username }, { email }],
  });

  // if given username or email already exists, throw an error.
  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  // path gets assigned to variable if all properties accross below chain exists..
  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  // upload on cloudinary!
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  // create user object - data entry in db
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "", // if coverImage exists then extract url, else ""
    email,
    password,
    username: username.toLowerCase(),
  });

  // removing password and refreshtoken if user found in database. "-"indicatess removal
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // check for user creation
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  // returning response
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

export { registerUser };
