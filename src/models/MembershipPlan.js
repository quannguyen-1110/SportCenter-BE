const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: "" },
  durationDays: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  priceVnd: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  // Retired plans stay for history (orders, memberships) but can no longer be sold.
  isActive: { type: Boolean, default: true },
}, { timestamps: true, collection: "membershipPlans" });

module.exports = mongoose.model("MembershipPlan", schema);
