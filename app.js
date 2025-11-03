// app.js
import express from "express";

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Hello from app.js 👋" });
});

// ✅ export the app
export default app;
