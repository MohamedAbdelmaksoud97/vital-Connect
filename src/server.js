import express from "express";
import "dotenv/config"; // loads .env
import app from "./app.js";
import mongoose from "mongoose";
const DB = process.env.MONGO_URI.replace("<db_password>", process.env.DATABASE_PASSWORD);
const PORT = process.env.PORT || 3000;

mongoose
  .connect(DB)
  .then(() => console.log("DB connection successful!"))
  .catch((err) => console.error("DB connection error:", err));

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
