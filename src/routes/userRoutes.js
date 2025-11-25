import express from "express";
import cookieParser from "cookie-parser";
import {
  signup,
  login,
  verifyEmail,
  resendVerification,
  logout,
  protect,
  restrictTo,
  updateMyPassword,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";
import {
  getMe,
  updateMe,
  deleteMe,
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
} from "../controllers/userController.js";
import { uploadProfilePic, resizeProfilePic } from "../controllers/fileController.js";
const router = express.Router();

// cookie parser must be used on the app (see app.js)
// auth
router.post("/signup", signup);
router.post("/login", login);
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);
router.post("/logout", logout);

// Forgot password - send reset link
router.post("/forgot-password", forgotPassword);

// Reset password - set new password
router.patch("/reset-password/:token", resetPassword);

// protected
router.use(protect);

router.get("/me", getMe);
router.patch(
  "/me",
  uploadProfilePic, // expects form-data field: profilePic
  resizeProfilePic, // sets req.body.profilePic
  updateMe, // your controller persists profilePic to DB
);
router.patch("/updateMyPassword", updateMyPassword);
router.delete("/me", deleteMe);

// admin
router.use(restrictTo("admin"));
router.get("/", getAllUsers);
router
  .route("/:id")
  .get(getUser)
  .patch(uploadProfilePic, resizeProfilePic, updateUser)
  .delete(deleteUser);

export default router;
