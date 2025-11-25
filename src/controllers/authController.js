import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";
import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";
dotenv.config();

/* ---------------- helpers ---------------- */
const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const sendCookie = (res, token) => {
  const isProd = process.env.NODE_ENV === "production";
  // days → ms
  const maxAgeMs =
    (parseInt(process.env.JWT_COOKIE_EXPIRES_DAYS || "7", 10) || 7) * 24 * 60 * 60 * 1000;

  res.cookie("jwt", token, {
    httpOnly: true,
    //  secure: isProd, // true on HTTPS (prod)
    // sameSite: isProd ? "none" : "lax", // "none" for cross-site on prod
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeMs,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id, user.role);
  user.password = undefined;
  sendCookie(res, token);
  res.status(statusCode).json({
    status: "success",
    data: { user },
  });
};

const genEmailToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_EMAIL_SECRET || process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

// helpers/emailToken.js

export const genPasswordResetToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_RESET_SECRET, {
    expiresIn: "15m", // short expiry for security
  });

/* ---------------- auth flows ---------------- */

// POST /api/v1/users/signup
export const signup = catchAsync(async (req, res, next) => {
  const { name, email, password, passwordConfirm, phone, image } = req.body;

  // Allow only 'patient' or 'doctor' from client
  const allowedRoles = ["patient", "doctor"];
  const requestedRole = typeof req.body.role === "string" ? req.body.role.toLowerCase() : null;
  const role = allowedRoles.includes(requestedRole) ? requestedRole : "patient";

  const newUser = await User.create({
    name,
    email,
    password,
    passwordConfirm,
    phone,
    image,
    role, // patient/doctor only
  });

  // email verification link (send via your mailer)
  const emailToken = genEmailToken(newUser._id);
  const verifyUrl = `${process.env.CLIENT_URL || "http://localhost:3000"}/verify-email?token=${emailToken}`;

  const htmlContent = `
    <h1>Email Verification</h1>
    <p>Hi ${newUser.name},</p>
    <p>Thank you for signing up! Please verify your email by clicking the link below:</p>
    <a href="${verifyUrl}" target="_blank">Verify Email</a>
    <p>If you did not sign up, please ignore this email.</p>
  `;

  // TODO: send email containing verifyUrl

  const msg = {
    to: newUser.email, // Recipient's email address
    from: "mohamedhoarra1@gmail.com", // Your verified sender email address
    subject: "verify your email for Vital Connect",
    //text: "This is a test email sent from SendGrid!",
    html: htmlContent,
  };
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  sgMail
    .send(msg)
    .then(() => {
      console.log("Email sent successfully");
    })
    .catch((error) => {
      console.error("Error sending email:", error);
    });
  res.status(201).json({
    status: "success",
    message: "Account created. Please verify your email.",
    verifyUrl, // dev only
  });
});

// GET /api/v1/users/verify-email?token=...
export const verifyEmail = catchAsync(async (req, res, next) => {
  const { token } = req.query;
  console.log("Verifying email with token:", token);
  if (!token) return next(new AppError("Verification token is required", 400));
  console.log(token);

  const decoded = jwt.verify(token, process.env.JWT_EMAIL_SECRET || process.env.JWT_SECRET);
  const user = await User.findById(decoded.userId);
  if (!user) return next(new AppError("Invalid or expired token", 400));
  console.log(user);

  if (!user.isVerified) {
    user.isVerified = true;
    await user.save({ validateBeforeSave: false });
  }

  // auto-login after verify
  createSendToken(user, 200, res);
});

// POST /api/v1/users/resend-verification
export const resendVerification = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return next(new AppError("No user with that email", 404));
  if (user.isVerified) return next(new AppError("Email already verified", 400));

  const emailToken = genEmailToken(user._id);
  const verifyUrl = `${process.env.CLIENT_URL || "http://localhost:3000"}/verify-email?token=${emailToken}`;
  // TODO: send email

  res.status(200).json({ status: "success", message: "Verification email sent.", verifyUrl });
});

// POST /api/v1/users/login
export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) return next(new AppError("Provide email and password", 400));

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password", 401));
  }
  if (!user.isVerified) return next(new AppError("Please verify your email first", 403));

  createSendToken(user, 200, res);
});

// POST /api/v1/users/logout
export const logout = (_req, res) => {
  // overwrite cookie with short expiry
  res.cookie("jwt", "loggedout", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    expires: new Date(Date.now() + 10 * 1000),
  });
  res.status(200).json({ status: "success" });
};

/* ------------- middlewares: protect & restrict ------------- */

export const protect = catchAsync(async (req, res, next) => {
  let token;

  // Prefer cookie
  if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  } else if (req.headers.authorization?.startsWith("Bearer")) {
    // fallback to header if needed
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) return next(new AppError("You are not logged in", 401));

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) return next(new AppError("The user no longer exists", 401));

  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(new AppError("Password changed recently. Please log in again.", 401));
  }

  req.user = currentUser;
  next();
});

export const restrictTo =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError("You do not have permission", 403));
    }
    next();
  };

/* ---------------- password update (cookie stays fresh) ---------------- */

// PATCH /api/v1/users/updateMyPassword
export const updateMyPassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword, newPasswordConfirm } = req.body;
  if (!currentPassword || !newPassword || !newPasswordConfirm) {
    return next(new AppError("Provide currentPassword, newPassword, newPasswordConfirm", 400));
  }

  const user = await User.findById(req.user.id).select("+password");
  if (!(await user.correctPassword(currentPassword, user.password))) {
    return next(new AppError("Your current password is wrong", 401));
  }

  user.password = newPassword;
  user.passwordConfirm = newPasswordConfirm;
  user.passwordChangedAt = Date.now();

  await user.save(); // triggers validators + hashing

  // rotate cookie
  createSendToken(user, 200, res);
});

// POST /api/v1/users/forgot-password

export const forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  if (!email) return next(new AppError("Please provide your email", 400));

  const user = await User.findOne({ email });
  if (!user) {
    // do NOT reveal user existence
    return res.status(200).json({
      status: "success",
      message: "If this email exists, a reset link has been sent",
    });
  }

  const resetToken = jwt.sign(
    { userId: user._id },
    process.env.JWT_RESET_SECRET || process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );

  const resetURL = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

  const htmlContent = `
  <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #222;">
    <h2 style="color: #333;">Password Reset Request</h2>
    <p>Hello ${user.name},</p>
    <p>You requested a password reset. Click the button below:</p>
    <p>
      <a href="${resetURL}"
         style="display:inline-block;padding:10px 18px;
                background:#2563eb;color:#ffffff;text-decoration:none;
                border-radius:4px;font-weight:bold;"
         target="_blank">
        Reset Password
      </a>
    </p>
    <p>This link expires in 15 minutes. If you did not request this, you can ignore this email.</p>
  </div>
`;

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  await sgMail.send({
    to: user.email,
    from: { email: process.env.SENDGRID_SENDER },
    subject: "Password Reset",
    html: htmlContent,
  });

  res.status(200).json({
    status: "success",
    message: "Reset link sent to email",
    //resetURL, // DEV ONLY
  });
});

// PATCH /api/v1/users/reset-password/:token

export const resetPassword = catchAsync(async (req, res, next) => {
  const { token } = req.params;
  const { newPassword, newPasswordConfirm } = req.body;

  if (!newPassword || !newPasswordConfirm) {
    return next(new AppError("Provide newPassword and newPasswordConfirm", 400));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_RESET_SECRET || process.env.JWT_SECRET);
  } catch (err) {
    return next(new AppError("Invalid or expired password reset token", 400));
  }

  const user = await User.findById(decoded.userId).select("+password");
  if (!user) return next(new AppError("User no longer exists", 404));

  user.password = newPassword;
  user.passwordConfirm = newPasswordConfirm;
  user.passwordChangedAt = Date.now();

  await user.save(); // hashing + validators auto-triggered

  createSendToken(user, 200, res); // auto-login after reset
});
