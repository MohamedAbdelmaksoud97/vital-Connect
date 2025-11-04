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

const router = express.Router();

// cookie parser must be used on the app (see app.js)
// auth
router.post("/signup", signup);
router.post("/login", login);
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);
router.post("/logout", logout);

// protected
router.use(protect);

router.get("/me", getMe);
router.patch("/me", updateMe);
router.patch("/updateMyPassword", updateMyPassword);
router.delete("/me", deleteMe);

// admin
router.use(restrictTo("admin"));
router.get("/", getAllUsers);
router.route("/:id").get(getUser).patch(updateUser).delete(deleteUser);

export default router;
