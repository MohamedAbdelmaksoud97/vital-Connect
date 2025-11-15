import Doctor from "../models/doctorModel.js";
import User from "../models/userModel.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";
import qs from "querystring"; // You can use the 'qs' module or URLSearchParams

// ... (your imports: catchAsync, Doctor, qs)

export const getAllDoctors = catchAsync(async (req, res, next) => {
  const queryObj = { ...req.query };

  const excludedFields = ["page", "sort", "limit", "fields"];
  excludedFields.forEach((el) => delete queryObj[el]);

  // This will hold all our MongoDB query parts
  let mongoQuery = {};

  // This array will hold our $or conditions
  const orConditions = [];

  // --- 1. NEW GENERIC SEARCH (for 'q') ---
  if (queryObj.q) {
    const query = queryObj.q;
    const regex = new RegExp(query, "i"); // Case-insensitive regex

    // A) Find USERS whose name matches
    const matchingUsers = await User.find({ name: regex }).select("_id");
    const userIds = matchingUsers.map((user) => user._id);

    // Add 3 OR conditions for 'q'
    orConditions.push({ userId: { $in: userIds } }); // 1. Match by name
    orConditions.push({ specialization: regex }); // 2. Match by specialization
    orConditions.push({ "clinic.city": regex }); // 3. Match by city
    orConditions.push({ "clinic.address": regex }); // 4. Match by address

    delete queryObj.q; // Remove 'q' so it's not processed below
  }

  // --- 2. SPECIFIC NAME SEARCH (for 'name') ---
  // (This still works if 'q' isn't used)
  if (queryObj.name) {
    const regex = new RegExp(queryObj.name, "i");
    const matchingUsers = await User.find({ name: regex }).select("_id");

    // Add to the main query as an $in
    mongoQuery.userId = { $in: matchingUsers.map((user) => user._id) };

    delete queryObj.name;
  }

  // --- 3. OTHER FILTERS (specialization, city, etc.) ---
  let filterStr = JSON.stringify(queryObj);
  filterStr = filterStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);
  const specificFilters = JSON.parse(filterStr);

  // Combine specific filters into the main query
  mongoQuery = { ...mongoQuery, ...specificFilters };

  // --- 4. COMBINE $OR AND OTHER FILTERS ---
  if (orConditions.length > 0) {
    // If we have 'q' search, we AND it with other filters
    // e.g., (name OR spec OR city) AND (status: "approved")
    mongoQuery = {
      $and: [
        { ...mongoQuery }, // All specific filters
        { $or: orConditions }, // All 'q' conditions
      ],
    };
  }
  // If no 'q' search, mongoQuery is just { ...specificFilters }

  console.log("Final MongoDB Query:", JSON.stringify(mongoQuery, null, 2));

  // --- 5. BUILD AND EXECUTE QUERY ---
  let query = Doctor.find(mongoQuery).populate("userId", "name email phone");

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
  const limit = req.query.limit * 1 || 100;
  const skip = (page - 1) * limit;

  query = query.skip(skip).limit(limit);

  // Execute Query
  const doctors = await query;

  // Send Response
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
  const { specialization, experience, consultationFee, clinic } = req.body;
  const userId = req.user.id;
  console.log(userId);
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
