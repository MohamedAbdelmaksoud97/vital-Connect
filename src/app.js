import express from "express";
import cookieParser from "cookie-parser";
import globalErrorHandler from "./controllers/errorControllers.js";
import doctorRouter from "./routes/doctorRoutes.js";
import userRouter from "./routes/userRoutes.js";
import patientRouter from "./routes/patientRoutes.js";
import appointmentRouter from "./routes/appointmentRoutes.js";
import prescriptionRouter from "./routes/prescriptionRoutes.js";
import reviewRouter from "./routes/reviewRoutes.js";
const app = express();

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({ message: "Hello from app.js 👋" });
});

app.use("/api/v1/users", userRouter);
app.use("/api/v1/doctors", doctorRouter);
app.use("/api/v1/patients", patientRouter);
app.use("/api/v1/appointments", appointmentRouter);
app.use("/api/v1/prescriptions", prescriptionRouter);
app.use("/api/v1/reviews", reviewRouter);

app.use(globalErrorHandler);

export default app;
