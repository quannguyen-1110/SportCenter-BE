const mongoose = require("mongoose");

module.exports = mongoose.model("PendingRegistration", new mongoose.Schema({
  _id: String,
  passwordHash: { type: String, required: true },
  otpHash: { type: String, required: true },
  attempts: { type: Number, required: true },
  resendAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}));
