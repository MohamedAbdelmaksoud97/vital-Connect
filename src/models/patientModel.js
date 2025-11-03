import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    age: Number,
    gender: String,
    bloodType: String,
    medicalHistory: [String],
    phone: String,
  },
  { timestamps: true },
);

const Patient = mongoose.model("Patient", patientSchema);
export default Patient;
