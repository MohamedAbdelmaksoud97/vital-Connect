import Doctor from "../models/doctorModel.js";
import User from "../models/userModel.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";
import qs from "querystring"; // You can use the 'qs' module or URLSearchParams

// 1️⃣ Get All Doctors with Filters, Sorting, Pagination
export const getAllDoctors = catchAsync(async (req, res, next) => {
  const queryObj = qs.parse(req.query);

  const excludedFields = ["page", "sort", "limit", "fields"];
  excludedFields.forEach((el) => delete queryObj[el]);

  // 2️⃣ Advanced Filtering: City, Specialization, Status
  let filterStr = JSON.stringify(queryObj);
  filterStr = filterStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);
  const filters = JSON.parse(filterStr);

  let query = Doctor.find(filters).populate("userId", "name email phone");

  // 3️⃣ Sorting
  if (req.query.sort) {
    const sortBy = req.query.sort.split(",").join(" ");
    query = query.sort(sortBy);
  } else {
    query = query.sort("-createdAt"); // Default to newest first
  }

  // 4️⃣ Field Limiting
  if (req.query.fields) {
    const fields = req.query.fields.split(",").join(" ");
    query = query.select(fields);
  } else {
    query = query.select("-__v"); // Default: Exclude __v
  }

  // 5️⃣ Pagination
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 100;
  const skip = (page - 1) * limit;

  query = query.skip(skip).limit(limit);

  // 6️⃣ Execute Query
  const doctors = await query;

  res.status(200).json({
    status: "success",
    results: doctors.length,
    data: doctors,
  });
});

// 2️⃣ Get Doctor by ID
export const getDoctorById = catchAsync(async (req, res, next) => {
  const doctor = await Doctor.findById(req.params.id).populate("userId", "name email phone");

  if (!doctor) {
    return next(new AppError("Doctor not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: { doctor },
  });
});

// 3️⃣ Create Doctor Profile
export const createDoctor = catchAsync(async (req, res, next) => {
  const { userId, specialization, experience, consultationFee, clinic } = req.body;

  const user = await User.findById(userId);
  if (!user || user.role !== "doctor") {
    return next(new AppError("Invalid or unauthorized user ID", 400));
  }

  const doctorExists = await Doctor.findOne({ userId });
  if (doctorExists) {
    return next(new AppError("Doctor profile already exists", 400));
  }

  const doctor = await Doctor.create({
    userId,
    specialization,
    experience,
    consultationFee,
    clinic,
  });

  res.status(201).json({
    status: "success",
    data: { doctor },
  });
});

// 4️⃣ Update Doctor Profile
export const updateDoctor = catchAsync(async (req, res, next) => {
  const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!doctor) {
    return next(new AppError("Doctor not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: { doctor },
  });
});

// 5️⃣ Admin: Approve/Reject Doctor
export const updateDoctorStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body; // "approved" or "rejected"

  const doctor = await Doctor.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true },
  );

  if (!doctor) {
    return next(new AppError("Doctor not found", 404));
  }

  // Optionally, update user.isVerified
  if (status === "approved") {
    await User.findByIdAndUpdate(doctor.userId, { isVerified: true });
  }

  res.status(200).json({
    status: "success",
    message: `Doctor has been ${status}`,
    data: { doctor },
  });
});

// 6️⃣ Delete Doctor Profile
export const deleteDoctor = catchAsync(async (req, res, next) => {
  const doctor = await Doctor.findByIdAndDelete(req.params.id);
  if (!doctor) return next(new AppError("Doctor not found", 404));

  res.status(204).json({ status: "success", data: null });
});
