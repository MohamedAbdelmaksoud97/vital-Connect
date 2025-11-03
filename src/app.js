import express from "express";
import globalErrorHandler from "./controllers/errorControllers.js";

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Hello from app.js 👋" });
});

app.use(globalErrorHandler);
export default app;
