import express from "express";
import {
  createReview,
  getAllReviews,
  getDoctorReviews,
  updateMyReview,
  deleteMyReview,
} from "../controllers/reviewController.js";
import { protect, restrictTo } from "../controllers/authController.js";

const router = express.Router();

// Route to get all reviews or create a new review
router
  .route("/")
  .get(getAllReviews) // Get all reviews with filters, pagination, etc.
  .post(protect, restrictTo("patient"), createReview); // Only patients can create reviews

// Routes to update or delete a specific review by reviewId
router
  .route("/:reviewId")
  .patch(protect, restrictTo("patient"), updateMyReview) // Only patients can update their reviews
  .delete(protect, restrictTo("patient"), deleteMyReview); // Only patients can delete their reviews

// Route to get reviews for a specific doctor
router.get("/doctor/:doctorId", getDoctorReviews); // Get reviews for a specific doctor

export default router;
