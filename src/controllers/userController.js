import User from "../models/userModel.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";
import { deleteProfilePicFile } from "./fileController.js";

const filterBody = (obj, ...allowed) => {
  const out = {};
  Object.keys(obj).forEach((k) => {
    if (allowed.includes(k)) out[k] = obj[k];
  });
  return out;
};

export const getMe = catchAsync(async (req, res, next) => {
  // Build the Mongoose query first, THEN await it.
  let query = User.findById(req.user.id);

  if (req.user.role === "doctor") query = query.populate("doctorProfile");
  if (req.user.role === "patient") query = query.populate("patientProfile");

  const user = await query; // now execute the query

  if (!user) return next(new AppError("User not found", 404));

  res.status(200).json({ status: "success", data: { user } });
});

export const updateMe = catchAsync(async (req, res, next) => {
  // Only allow updating safe fields
  const allowed = ["name", "phone", "profilePic"];
  const payload = {};
  allowed.forEach((f) => {
    if (req.body[f] !== undefined) payload[f] = req.body[f];
  });

  const user = await User.findById(req.user.id);
  if (!user) return next(new AppError("User not found", 404));

  // If new profilePic uploaded, delete old one on disk
  if (payload.profilePic && user.profilePic && user.profilePic !== payload.profilePic) {
    deleteProfilePicFile(user.profilePic);
  }

  Object.assign(user, payload);
  await user.save({ validateModifiedOnly: true });

  res.status(200).json({
    status: "success",
    data: { user },
  });
});

export const deleteMe = catchAsync(async (req, res) => {
  await User.findByIdAndDelete(req.user.id);
  res.status(204).json({ status: "success", data: null });
});

/* admin */
export const getAllUsers = catchAsync(async (_req, res) => {
  const users = await User.find().select("-__v");
  res.status(200).json({ status: "success", results: users.length, data: { users } });
});

export const getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new AppError("User not found", 404));
  res.status(200).json({ status: "success", data: { user } });
});

export const updateUser = catchAsync(async (req, res, next) => {
  const updates = filterBody(req.body, "name", "phone", "profilePic", "role", "isVerified");
  const user = await User.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!user) return next(new AppError("User not found", 404));
  res.status(200).json({ status: "success", data: { user } });
});

export const deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return next(new AppError("User not found", 404));
  res.status(204).json({ status: "success", data: null });
});
