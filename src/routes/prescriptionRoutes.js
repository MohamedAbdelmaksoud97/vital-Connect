import express from "express";
import { protect } from "../controllers/authController.js"; // or your auth middleware
import {
  createPrescription,
  getPrescriptionById,
  getPrescriptions,
  updatePrescription,
  deletePrescription,
} from "../controllers/prescriptionController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Create a prescription (doctor/admin)
router.post("/", createPrescription);

// List prescriptions (scoped to viewer)
router.get("/", getPrescriptions);

// Single prescription (view with access control)
router.get("/:id", getPrescriptionById);

// Update prescription (author doctor/admin)
router.patch("/:id", updatePrescription);

// Delete prescription (author doctor/admin)
router.delete("/:id", deletePrescription);

export default router;
