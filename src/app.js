import express from "express";
import cookieParser from "cookie-parser";
import globalErrorHandler from "./controllers/errorControllers.js";
import doctorRouter from "./routes/doctorRoutes.js";
import userRouter from "./routes/userRoutes.js";
import patientRouter from "./routes/patientRoutes.js";
const app = express();

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({ message: "Hello from app.js 👋" });
});

app.use("/api/v1/users", userRouter);
app.use("/api/v1/doctors", doctorRouter);
app.use("/api/v1/patients", patientRouter);

app.use(globalErrorHandler);

export default app;
