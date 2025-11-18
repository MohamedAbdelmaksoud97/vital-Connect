import express from "express";
import cookieParser from "cookie-parser";
import globalErrorHandler from "./controllers/errorControllers.js";
import doctorRouter from "./routes/doctorRoutes.js";
import userRouter from "./routes/userRoutes.js";
import patientRouter from "./routes/patientRoutes.js";
import appointmentRouter from "./routes/appointmentRoutes.js";
import prescriptionRouter from "./routes/prescriptionRoutes.js";
import reviewRouter from "./routes/reviewRoutes.js";
import path from "path";
import cors from "cors";
import xss from "xss";

// 🔐 Security middlewares
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
//import xss from "xss-clean";
//import sanitizeHtml from "sanitize-html";
import hpp from "hpp";

const app = express();

/* ---------------------------------------------------
   🔐 1) CORS (allow cookies + frontend URLs)
---------------------------------------------------- */
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:5178"],
    credentials: true, // cookies allowed
  }),
);

/* ---------------------------------------------------
   🔐 2) Set Security HTTP Headers
---------------------------------------------------- */
app.use(helmet()); // always first in stack

/* ---------------------------------------------------
   🔐 3) Rate Limiting → prevent brute-force & DoS
---------------------------------------------------- */

const limiter = rateLimit({
  max: 100, // 100 req per IP
  windowMs: 60 * 60 * 1000, // 1 hour
  message: "Too many requests from this IP. Try again in 1 hour.",
});
app.use("/api", limiter);

/* ---------------------------------------------------
   🔐 4) Body Parser + Body Size Limit
---------------------------------------------------- */
app.use(express.json({ limit: "10kb" }));

/* ---------------------------------------------------
   🔐 5) Cookie Parser
---------------------------------------------------- */
app.use(cookieParser());

/* ---------------------------------------------------
   🔐 6) Data Sanitization (against NoSQL injection)
---------------------------------------------------- */
// 🔐 Custom NoSQL Injection Sanitizer
const sanitize = (obj) => {
  for (const key in obj) {
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key];
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      sanitize(obj[key]);
    }
  }
};

app.use((req, res, next) => {
  sanitize(req.body);
  sanitize(req.params);
  sanitize(req.query); // safe: we do NOT replace the object
  next();
});

/* ---------------------------------------------------
   🔐 7) Data Sanitization (against XSS attacks)

   
---------------------------------------------------- */
// this should be done
const sanitizeXSS = (obj) => {
  if (!obj || typeof obj !== "object") return;

  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

    const value = obj[key];

    if (typeof value === "string") {
      // Clean any HTML/JS in strings
      obj[key] = xss(value);
    } else if (typeof value === "object" && value !== null) {
      // Recurse into nested objects/arrays
      sanitizeXSS(value);
    }
  }
};

app.use((req, res, next) => {
  sanitizeXSS(req.body);
  sanitizeXSS(req.query);
  sanitizeXSS(req.params);
  next();
});

/* ---------------------------------------------------
   🔐 8) Prevent Parameter Pollution (HPP)
---------------------------------------------------- */
app.use(
  hpp({
    whitelist: [
      "duration",
      "ratingsQuantity",
      "ratingsAverage",
      "maxGroupSize",
      "difficulty",
      "price",
      "experience",
    ],
  }),
);

/* ---------------------------------------------------
   🔧 Static Files (Profile Pictures)
---------------------------------------------------- */
app.use(
  "/img/profilePics",
  express.static(path.join(process.cwd(), "public", "img", "profilePics"), {
    maxAge: "30d",
    immutable: true,
  }),
);

/* ---------------------------------------------------
   🌐 Test Route
---------------------------------------------------- */

/* ---------------------------------------------------
   📦 API Routes
---------------------------------------------------- */
app.use("/api/v1/users", userRouter);
app.use("/api/v1/doctors", doctorRouter);
app.use("/api/v1/patients", patientRouter);
app.use("/api/v1/appointments", appointmentRouter);
app.use("/api/v1/prescriptions", prescriptionRouter);
app.use("/api/v1/reviews", reviewRouter);

/* ---------------------------------------------------
   🌍 Serve Frontend (React build)
---------------------------------------------------- */
const rootPath = process.cwd();

// Serve static files
app.use(express.static(path.join(rootPath, "public", "dist")));

// React Router fallback for NON-API routes
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next(); // let API routes work
  }

  res.sendFile(path.join(rootPath, "public", "dist", "index.html"));
});

/* ---------------------------------------------------
   ❌ Global Error Handler
---------------------------------------------------- */
app.use(globalErrorHandler);

export default app;
