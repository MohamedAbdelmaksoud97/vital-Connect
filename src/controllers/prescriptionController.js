import Prescription from "../models/prescriptionModel.js";
import Appointment from "../models/appointmentModel.js";
import Doctor from "../models/doctorModel.js";
import Patient from "../models/patientModel.js";
import AppError from "../utils/appError.js";
import catchAsync from "../utils/catchAsync.js";

/** Helpers */
const getDoctorProfile = async (userId) => Doctor.findOne({ userId });
const getPatientProfile = async (userId) => Patient.findOne({ userId });

const canViewPrescription = (user, prescription, doctorId, patientId) => {
  if (user.role === "admin") return true;
  if (user.role === "doctor" && doctorId && String(prescription.doctorId) === String(doctorId))
    return true;
  if (user.role === "patient" && patientId && String(prescription.patientId) === String(patientId))
    return true;
  return false;
};

const canModifyPrescription = (user, prescription, doctorId) => {
  if (user.role === "admin") return true;
  if (user.role === "doctor" && doctorId && String(prescription.doctorId) === String(doctorId))
    return true;
  return false;
};

/** 1) Create Prescription (doctor or admin) */
export const createPrescription = catchAsync(async (req, res, next) => {
  const { appointmentId, doctorId, patientId, medications, notes } = req.body;

  // Resolve acting identities
  let actingDoctorId = doctorId;

  if (req.user.role === "doctor") {
    const doctor = await getDoctorProfile(req.user.id);
    if (!doctor) return next(new AppError("Doctor profile not found", 404));
    actingDoctorId = doctor._id;
  } else if (req.user.role !== "admin") {
    return next(new AppError("Only doctors or admins can create prescriptions", 403));
  }

  // Basic validations
  if (!appointmentId || !actingDoctorId || !patientId) {
    return next(new AppError("appointmentId, doctorId, and patientId are required", 400));
  }

  // Ensure appointment exists and (optionally) matches doctor/patient
  const appt = await Appointment.findById(appointmentId);
  if (!appt) return next(new AppError("Appointment not found", 404));
  if (String(appt.doctorId) !== String(actingDoctorId)) {
    return next(new AppError("Doctor mismatch with appointment", 400));
  }
  if (String(appt.patientId) !== String(patientId)) {
    return next(new AppError("Patient mismatch with appointment", 400));
  }

  const prescription = await Prescription.create({
    appointmentId,
    doctorId: actingDoctorId,
    patientId,
    medications,
    notes,
  });

  res.status(201).json({
    status: "success",
    data: { prescription },
  });
});

/** 2) Get One Prescription (admin, author doctor, or the patient) */
export const getPrescriptionById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const prescription = await Prescription.findById(id)
    .populate("doctorId", "name userId")
    .populate("patientId", "name userId")
    .populate("appointmentId");

  if (!prescription) return next(new AppError("Prescription not found", 404));

  // Resolve viewer profiles
  const doctor = req.user.role === "doctor" ? await getDoctorProfile(req.user.id) : null;
  const patient = req.user.role === "patient" ? await getPatientProfile(req.user.id) : null;

  if (!canViewPrescription(req.user, prescription, doctor?._id, patient?._id)) {
    return next(new AppError("Not authorized to view this prescription", 403));
  }

  res.status(200).json({
    status: "success",
    data: { prescription },
  });
});

/** 3) Get Prescriptions list (restricted to viewer's scope) */
export const getPrescriptions = catchAsync(async (req, res, next) => {
  // Optional filters: appointmentId, patientId, doctorId
  const { appointmentId } = req.query;
  let { patientId, doctorId } = req.query;

  // Restrict scope by role
  if (req.user.role === "doctor") {
    const doctor = await getDoctorProfile(req.user.id);
    if (!doctor) return next(new AppError("Doctor profile not found", 404));
    doctorId = String(doctor._id); // force to own
  } else if (req.user.role === "patient") {
    const patient = await getPatientProfile(req.user.id);
    if (!patient) return next(new AppError("Patient profile not found", 404));
    patientId = String(patient._id); // force to own
  } // admin can use any filters

  let query = Prescription.find();

  if (appointmentId) query = query.where("appointmentId").equals(appointmentId);
  if (doctorId) query = query.where("doctorId").equals(doctorId);
  if (patientId) query = query.where("patientId").equals(patientId);

  // Basic sorting/pagination (optional)
  if (req.query.sort) query = query.sort(req.query.sort);
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;
  const skip = (page - 1) * limit;
  query = query.skip(skip).limit(limit);

  const prescriptions = await query
    .populate("doctorId", "name userId")
    .populate("patientId", "name userId");

  res.status(200).json({
    status: "success",
    results: prescriptions.length,
    data: { prescriptions },
  });
});

/** 4) Update Prescription (author doctor or admin) */
export const updatePrescription = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const prescription = await Prescription.findById(id);
  if (!prescription) return next(new AppError("Prescription not found", 404));

  const doctor = req.user.role === "doctor" ? await getDoctorProfile(req.user.id) : null;

  if (!canModifyPrescription(req.user, prescription, doctor?._id)) {
    return next(new AppError("Not authorized to modify this prescription", 403));
  }

  // Allow updating medications/notes only (safe fields)
  const { medications, notes } = req.body;
  if (medications !== undefined) prescription.medications = medications;
  if (notes !== undefined) prescription.notes = notes;

  await prescription.save();

  res.status(200).json({
    status: "success",
    data: { prescription },
  });
});

/** 5) Delete Prescription (author doctor or admin) */
export const deletePrescription = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const prescription = await Prescription.findById(id);
  if (!prescription) return next(new AppError("Prescription not found", 404));

  const doctor = req.user.role === "doctor" ? await getDoctorProfile(req.user.id) : null;

  if (!canModifyPrescription(req.user, prescription, doctor?._id)) {
    return next(new AppError("Not authorized to delete this prescription", 403));
  }

  await Prescription.findByIdAndDelete(id);

  res.status(204).json({
    status: "success",
    data: null,
  });
});
