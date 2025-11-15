import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    specialization: {
      type: String,
      required: [true, "Specialization is required"],
    },
    experience: {
      type: Number,
      required: [true, "Experience (in years) is required"],
    },
    consultationFee: {
      type: Number,
      required: [true, "Consultation fee is required"],
    },
    bio: String,
    clinic: {
      name: String,
      address: String,
      city: String,
      lat: Number,
      lng: Number,
    },
    availableDays: [String], // ["Mon", "Wed"]
    availableSlots: [String], // ["09:00–12:00"]
    rating: {
      type: Number,
      default: 0,
    },
    reviewsCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true },
);

doctorSchema.methods.calculateRating = async function () {
  const Review = mongoose.model("Review");
  const stats = await Review.aggregate([
    { $match: { doctorId: this._id } },
    {
      $group: {
        _id: "$doctorId",
        avgRating: { $avg: "$rating" },
        nRatings: { $sum: 1 },
      },
    },
  ]);
  if (stats.length > 0) {
    this.rating = stats[0].avgRating;
    this.reviewsCount = stats[0].nRatings;
  } else {
    this.rating = 0;
    this.reviewsCount = 0;
  }
  await this.save();
};

const Doctor = mongoose.model("Doctor", doctorSchema);

export default Doctor;
