
const mongoose = require("mongoose");

const emailOTPSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
      select: false,
    },
    purpose: {
      type: String,
      enum: ["GOOGLE_LOGIN"],
      default: "GOOGLE_LOGIN",
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    verified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

emailOTPSchema.index({ email: 1, purpose: 1 });

module.exports = mongoose.model("EmailOTP", emailOTPSchema);
