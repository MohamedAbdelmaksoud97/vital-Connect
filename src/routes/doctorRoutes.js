import express from "express";
import {
  getAllDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  updateDoctorStatus,
  deleteDoctor,
} from "../controllers/doctorController.js";
import { protect, restrictTo } from "../controllers/authController.js";
const router = express.Router();

// Public Routes: Get all doctors (filter, sort, paginate)
router.route("/").get(getAllDoctors);

// Protected Routes: These require doctor login and admin privileges
router.route("/:id").get(getDoctorById); // Get doctor details by ID

router.use(protect);
// Admin Route: Approve or reject doctor profile

// Doctor-specific Routes: Create, Update, Delete

router.route("/").post(createDoctor); // Create a doctor profile
router.route("/:id").patch(updateDoctor).delete(deleteDoctor); // Update or delete a doctor

router.use(restrictTo("admin"));
router.route("/:id/status").patch(updateDoctorStatus);
export default router;
