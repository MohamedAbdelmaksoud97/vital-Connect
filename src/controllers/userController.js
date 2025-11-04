import User from "../models/userModel.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";

const filterBody = (obj, ...allowed) => {
  const out = {};
  Object.keys(obj).forEach((k) => {
    if (allowed.includes(k)) out[k] = obj[k];
  });
  return out;
};

export const getMe = catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (req.user.role === "doctor") query = query.populate("doctorProfile");
  if (req.user.role === "patient") query = query.populate("patientProfile");
  res.status(200).json({ status: "success", data: { user } });
});

export const updateMe = catchAsync(async (req, res, next) => {
  if (req.body.password || req.body.passwordConfirm) {
    return next(new AppError("Use /updateMyPassword to change password", 400));
  }
  const updates = filterBody(req.body, "name", "phone", "image");
  const updatedUser = await User.findByIdAndUpdate(req.user.id, updates, {
    new: true,
    runValidators: true,
  });
  res.status(200).json({ status: "success", data: { user: updatedUser } });
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
  const updates = filterBody(req.body, "name", "phone", "image", "role", "isVerified");
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
