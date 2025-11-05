import Appointment from "../models/appointmentModel.js";
import Doctor from "../models/doctorModel.js";
import Patient from "../models/patientModel.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";
import e from "express";
import qs from "querystring"; // You can use the 'qs' module or URLSearchParams
import User from "../models/userModel.js";

// 1️⃣ Patient or Admin: Book an Appointment
export const bookAppointment = catchAsync(async (req, res, next) => {
  const { doctorId, patientId, date, timeSlot, bookingFee, notes } = req.body;

  const doctor = await Doctor.findById(doctorId);
  if (!doctor) return next(new AppError("Doctor not found", 404));

  const patient = await Patient.findById(patientId);
  if (!patient) return next(new AppError("Patient not found", 404));

  const appointment = await Appointment.create({
    doctorId,
    patientId,
    date,
    timeSlot,
    bookingFee,
    notes,
  });

  res.status(201).json({
    status: "success",
    data: { appointment },
  });
});

// 2️⃣ Admin or Doctor: Change Appointment Status
export const changeAppointmentStatus = catchAsync(async (req, res, next) => {
  console.log(req.user);
  const { appointmentId } = req.params;
  const { status } = req.body;

  if (!["pending", "confirmed", "completed", "cancelled"].includes(status)) {
    return next(new AppError("Invalid status", 400));
  }

  const appointment = await Appointment.findById(appointmentId);
  const doctor = await Doctor.findOne({ userId: req.user.id });
  console.log(doctor);
  if (!appointment) return next(new AppError("Appointment not found", 404));

  // Only doctor or admin can change status
  if (req.user.role !== "admin" && String(appointment.doctorId) !== String(doctor._id)) {
    return next(new AppError("Not authorized to change the status", 403));
  }

  appointment.status = status;
  await appointment.save();

  res.status(200).json({
    status: "success",
    data: { appointment },
  });
});
// 4️⃣ Patient: Get My Appointments (can filter by status)
// 4️⃣ Patient: Get My Appointments (can filter by status, sorting, pagination, etc.)
export const getMyAppointments = catchAsync(async (req, res, next) => {
  const role = req.user.role;
  const userId = req.user.id;
  const doctor = await Doctor.findOne({ userId });
  const patient = await Patient.findOne({ userId });

  if (role === "doctor" && !doctor) {
    return next(new AppError("Doctor profile not found", 404));
  }
  if (role === "patient" && !patient) {
    return next(new AppError("Patient profile not found", 404));
  }

  // Query parameters for filtering
  const queryObj = qs.parse(req.query);

  const excludedFields = ["page", "sort", "limit", "fields"];
  excludedFields.forEach((el) => delete queryObj[el]);

  // 2️⃣ Advanced Filtering: Appointment Status, Date, etc.
  let filterStr = JSON.stringify(queryObj);
  filterStr = filterStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);
  const filters = JSON.parse(filterStr);

  let query = Appointment.find(filters);

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
  let appointments = [];
  if (role === "doctor") {
    const doctor = await Doctor.findOne({ userId });
    if (!doctor) {
      return next(new AppError("Doctor profile not found", 404));
    }
    appointments = await query
      .find({ doctorId: doctor._id })
      .populate("patientId", "name email phone");
  } else if (role === "patient") {
    const patient = await Patient.findOne({ userId });
    if (!patient) {
      return next(new AppError("Patient profile not found", 404));
    }
    appointments = await query
      .find({ patientId: patient._id })
      .populate("doctorId", "name specialization email phone");
  }

  if (!appointments || appointments.length === 0) {
    return next(new AppError("No appointments found", 404));
  }

  res.status(200).json({
    status: "success",
    results: appointments.length,
    data: { appointments },
  });
});

export const getUserAppointments = catchAsync(async (req, res, next) => {
  const { userId } = req.params;

  // Fetch the user first
  const user = await User.findById(userId); // Add await here
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // If the user is a doctor, fetch doctor appointments
  if (user.role === "doctor") {
    const doctor = await Doctor.findOne({ userId });
    if (!doctor) {
      return next(new AppError("Doctor profile not found", 404));
    }

    const appointments = await Appointment.find({ doctorId: doctor._id }).populate(
      "patientId",
      "name email phone",
    );
    if (!appointments || appointments.length === 0) {
      return next(new AppError("No appointments found for this doctor", 404));
    }

    return res.status(200).json({
      status: "success",
      results: appointments.length,
      data: { appointments },
    });
  }

  // If the user is a patient, fetch patient appointments
  else if (user.role === "patient") {
    const patient = await Patient.findOne({ userId });
    if (!patient) {
      return next(new AppError("Patient profile not found", 404));
    }

    const appointments = await Appointment.find({ patientId: patient._id }).populate(
      "doctorId",
      "name email specialty",
    );
    if (!appointments || appointments.length === 0) {
      return next(new AppError("No appointments found for this patient", 404));
    }

    return res.status(200).json({
      status: "success",
      results: appointments.length,
      data: { appointments },
    });
  }

  // If the role is neither a doctor nor a patient, handle accordingly
  else {
    return next(new AppError("Invalid role for user", 400));
  }
});

// 6️⃣ Admin or Doctor: Cancel Appointment
export const cancelAppointment = catchAsync(async (req, res, next) => {
  const { appointmentId } = req.params;
  const appointment = await Appointment.findById(appointmentId);

  if (!appointment) {
    return next(new AppError("Appointment not found", 404));
  }

  const user = req.user;

  // Check for doctor role
  if (user.role === "doctor") {
    const doctor = await Doctor.findOne({ userId: user.id });
    if (!doctor) {
      return next(new AppError("Doctor profile not found", 404));
    }
    if (String(appointment.doctorId) !== String(doctor._id)) {
      return next(new AppError("Not authorized to cancel this appointment", 403));
    }

    // Check for patient role
  } else if (user.role === "patient") {
    const patient = await Patient.findOne({ userId: user.id });
    if (!patient) {
      return next(new AppError("Patient profile not found", 404));
    }
    if (String(appointment.patientId) !== String(patient._id)) {
      return next(new AppError("Not authorized to cancel this appointment", 403));
    }

    // Check for admin role (no further conditions needed)
  } else if (user.role === "admin") {
    // Admin can cancel any appointment
  } else {
    return next(new AppError("Not authorized to cancel this appointment", 403));
  }

  // Update status to cancelled and save
  appointment.status = "cancelled";
  await appointment.save();

  return res.status(200).json({
    status: "success",
    data: { appointment },
  });
});
