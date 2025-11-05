import express from "express";
import {
  bookAppointment,
  changeAppointmentStatus,
  //getAllAppointments,
  getMyAppointments,
  getUserAppointments,
  cancelAppointment,
} from "../controllers/appointmentController.js";
import { protect, restrictTo } from "../controllers/authController.js";

const router = express.Router();

/* ---------- Book an appointment (patient or admin) ---------- */
router.post("/", protect, restrictTo("patient", "admin"), bookAppointment);

/* ---------- Admin or Doctor: Change status of appointment ---------- */
router.patch(
  "/:appointmentId/status",
  protect,
  restrictTo("admin", "doctor"),
  changeAppointmentStatus,
);

/* ---------- Get all appointments (admin) ---------- */
//router.get("/", protect, restrictTo("admin"), getAllAppointments);

/* ---------- Patient: Get my appointments (not cancelled) ---------- */
router.get("/me", protect, restrictTo("patient", "doctor"), getMyAppointments);

/* ---------- Doctor or Admin: Get doctor-specific appointments ---------- */
router.get("/:userId", protect, restrictTo("admin"), getUserAppointments);

/* ---------- Cancel appointment (admin or doctor) ---------- */
router.patch("/:appointmentId/cancel", protect, cancelAppointment);

export default router;
