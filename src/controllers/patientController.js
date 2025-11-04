import qs from "querystring"; // for advanced filtering style like age[gte]=20
import Patient from "../models/patientModel.js";
import User from "../models/userModel.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";

/* -------------------------------------------------------------------------- */
/*                           Admin: list with filters                         */
/*   GET /api/v1/patients?gender=Male&bloodType=O+&age[gte]=20&age[lte]=60    */
/*   + sort, fields, page, limit                                              */
/* -------------------------------------------------------------------------- */
export const getAllPatients = catchAsync(async (req, res, next) => {
  const queryObj = qs.parse(req.query);

  const excluded = ["page", "sort", "limit", "fields"];
  excluded.forEach((k) => delete queryObj[k]);

  // convert gte/gt/lte/lt
  let filterStr = JSON.stringify(queryObj);
  filterStr = filterStr.replace(/\b(gte|gt|lte|lt)\b/g, (m) => `$${m}`);
  const filters = JSON.parse(filterStr);

  let query = Patient.find(filters).populate("userId", "name email phone image isVerified role");

  // sorting
  if (req.query.sort) {
    const sortBy = req.query.sort.split(",").join(" ");
    query = query.sort(sortBy);
  } else {
    query = query.sort("-createdAt");
  }

  // field limiting
  if (req.query.fields) {
    const fields = req.query.fields.split(",").join(" ");
    query = query.select(fields);
  } else {
    query = query.select("-__v");
  }

  // pagination
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 50;
  const skip = (page - 1) * limit;
  query = query.skip(skip).limit(limit);

  const patients = await query;

  res.status(200).json({
    status: "success",
    results: patients.length,
    data: { patients },
  });
});

/* -------------------------------------------------------------------------- */
/*                        Admin: get patient by id (ObjectId)                 */
/*                        GET /api/v1/patients/:id                            */
/* -------------------------------------------------------------------------- */
export const getPatientById = catchAsync(async (req, res, next) => {
  const patient = await Patient.findById(req.params.id).populate(
    "userId",
    "name email phone image isVerified role",
  );
  if (!patient) return next(new AppError("Patient not found", 404));

  res.status(200).json({ status: "success", data: { patient } });
});

/* -------------------------------------------------------------------------- */
/*                      Self: create patient profile (once)                   */
/*                           POST /api/v1/patients                            */
/* -------------------------------------------------------------------------- */
export const createMyPatientProfile = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const user = await User.findById(userId);
  if (!user || user.role !== "patient") {
    return next(new AppError("Only users with role 'patient' can create a patient profile", 403));
  }

  const exists = await Patient.findOne({ userId });
  if (exists) return next(new AppError("Patient profile already exists", 400));

  const { age, gender, bloodType, medicalHistory, phone } = req.body;

  const patient = await Patient.create({
    userId,
    age,
    gender,
    bloodType,
    medicalHistory,
    phone,
  });

  res.status(201).json({ status: "success", data: { patient } });
});

/* -------------------------------------------------------------------------- */
/*                        Self: get my patient profile                        */
/*                         GET /api/v1/patients/me                            */
/* -------------------------------------------------------------------------- */
export const getMyPatientProfile = catchAsync(async (req, res, next) => {
  const patient = await Patient.findOne({ userId: req.user.id }).populate(
    "userId",
    "name email phone image isVerified role",
  );
  if (!patient) return next(new AppError("No patient profile found for this user", 404));
  res.status(200).json({ status: "success", data: { patient } });
});

/* -------------------------------------------------------------------------- */
/*                     Self: update my patient profile                        */
/*                     PATCH /api/v1/patients/me                              */
/* -------------------------------------------------------------------------- */
export const updateMyPatientProfile = catchAsync(async (req, res, next) => {
  // prevent userId change
  if ("userId" in req.body) delete req.body.userId;

  const updates = req.body;
  const patient = await Patient.findOneAndUpdate({ userId: req.user.id }, updates, {
    new: true,
    runValidators: true,
  });
  if (!patient) return next(new AppError("No patient profile found for this user", 404));

  res.status(200).json({ status: "success", data: { patient } });
});

/* -------------------------------------------------------------------------- */
/*                       Admin: update patient by id                          */
/*                   PATCH /api/v1/patients/:id                               */
/* -------------------------------------------------------------------------- */
export const updatePatient = catchAsync(async (req, res, next) => {
  const patient = await Patient.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!patient) return next(new AppError("Patient not found", 404));

  res.status(200).json({ status: "success", data: { patient } });
});

/* -------------------------------------------------------------------------- */
/*                       Admin: delete patient by id                          */
/*                     DELETE /api/v1/patients/:id                            */
/* -------------------------------------------------------------------------- */
export const deletePatient = catchAsync(async (req, res, next) => {
  const patient = await Patient.findByIdAndDelete(req.params.id);
  if (!patient) return next(new AppError("Patient not found", 404));

  res.status(204).json({ status: "success", data: null });
});
