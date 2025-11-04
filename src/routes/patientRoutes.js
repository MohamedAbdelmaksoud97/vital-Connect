import express from "express";
import {
  getAllPatients,
  getPatientById,
  createMyPatientProfile,
  getMyPatientProfile,
  updateMyPatientProfile,
  updatePatient,
  deletePatient,
} from "../controllers/patientController.js";
import { protect, restrictTo } from "../controllers/authController.js";

const router = express.Router();

/* ---------- self (patient) ---------- */
router.post("/", protect, restrictTo("patient"), createMyPatientProfile);
router.get("/me", protect, restrictTo("patient"), getMyPatientProfile);
router.patch("/me", protect, restrictTo("patient"), updateMyPatientProfile);

/* ---------- admin ---------- */
router.get("/", protect, restrictTo("admin"), getAllPatients);
router
  .route("/:id")
  .get(protect, restrictTo("admin"), getPatientById)
  .patch(protect, restrictTo("admin"), updatePatient)
  .delete(protect, restrictTo("admin"), deletePatient);

export default router;
