import Review from "../models/reviewModel.js";
import Doctor from "../models/doctorModel.js";
import Patient from "../models/patientModel.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";
import qs from "qs";

// 1️⃣ Patient: Create a Review
export const createReview = catchAsync(async (req, res, next) => {
  const { doctorId, rating, comment } = req.body;

  // Find the patient using req.user._id (this references the patient who is logged in)
  const patient = await Patient.findOne({ userId: req.user._id });
  if (!patient) return next(new AppError("Patient not found", 404));

  const doctor = await Doctor.findById(doctorId);
  if (!doctor) return next(new AppError("Doctor not found", 404));

  const review = await Review.create({
    doctorId,
    patientId: patient._id, // Set patientId as the found patient
    rating,
    comment,
  });

  res.status(201).json({
    status: "success",
    data: { review },
  });
});

// 2️⃣ Get All Reviews (with filtering, sorting, pagination)
export const getAllReviews = catchAsync(async (req, res, next) => {
  const queryObj = qs.parse(req.query);
  const excludedFields = ["page", "sort", "limit", "fields"];
  excludedFields.forEach((el) => delete queryObj[el]);

  // Advanced Filtering
  let filterStr = JSON.stringify(queryObj);
  filterStr = filterStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);
  const filters = JSON.parse(filterStr);

  let query = Review.find(filters)
    .populate("doctorId", "name specialization")
    .populate("patientId", "name email");

  // Sorting
  if (req.query.sort) {
    const sortBy = req.query.sort.split(",").join(" ");
    query = query.sort(sortBy);
  } else {
    query = query.sort("-createdAt");
  }

  // Field Limiting
  if (req.query.fields) {
    const fields = req.query.fields.split(",").join(" ");
    query = query.select(fields);
  } else {
    query = query.select("-__v");
  }

  // Pagination
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 10;
  const skip = (page - 1) * limit;

  query = query.skip(skip).limit(limit);

  const reviews = await query;

  res.status(200).json({
    status: "success",
    results: reviews.length,
    data: { reviews },
  });
});

// 3️⃣ Get Reviews for a Specific Doctor
export const getDoctorReviews = catchAsync(async (req, res, next) => {
  const { doctorId } = req.params;

  const reviews = await Review.find({ doctorId })
    .populate("patientId", "name email")
    .sort("-createdAt");

  if (!reviews || reviews.length === 0) {
    return next(new AppError("No reviews found for this doctor", 404));
  }

  res.status(200).json({
    status: "success",
    results: reviews.length,
    data: { reviews },
  });
});

// 4️⃣ Patient: Update My Review
export const updateMyReview = catchAsync(async (req, res, next) => {
  const { reviewId } = req.params;
  const { rating, comment } = req.body;

  const review = await Review.findById(reviewId);
  if (!review) return next(new AppError("Review not found", 404));

  // Ensure the logged-in user is the one who created the review
  const patient = await Patient.findOne({ userId: req.user._id });
  if (!patient || String(review.patientId) !== String(patient._id)) {
    return next(new AppError("You can only edit your own reviews", 403));
  }

  review.rating = rating ?? review.rating;
  review.comment = comment ?? review.comment;

  await review.save();

  res.status(200).json({
    status: "success",
    data: { review },
  });
});

// 5️⃣ Patient: Delete My Review
export const deleteMyReview = catchAsync(async (req, res, next) => {
  const { reviewId } = req.params;

  const review = await Review.findById(reviewId);
  if (!review) return next(new AppError("Review not found", 404));

  // Ensure the logged-in user is the one who created the review
  const patient = await Patient.findOne({ userId: req.user._id });
  if (!patient || String(review.patientId) !== String(patient._id)) {
    return next(new AppError("You can only delete your own reviews", 403));
  }

  await review.deleteOne();

  res.status(204).json({
    status: "success",
    data: null,
  });
});
