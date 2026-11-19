const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: "MembershipPlan", required: true },
  planName: { type: String, required: true },
  durationDays: { type: Number, required: true, min: 1, max: 3650, validate: Number.isSafeInteger },
  amount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  status: { type: String, enum: ["PENDING", "SUCCESS", "FAILED"], default: "PENDING" },
  payosOrderCode: { type: Number, required: true, unique: true, validate: Number.isSafeInteger },
  payosCheckoutUrl: String,
  membershipId: { type: mongoose.Schema.Types.ObjectId, ref: "Membership" },
  paidAt: Date,
}, { timestamps: true, collection: "membershipOrders" });

schema.index(
  { memberId: 1, planId: 1 },
  { unique: true, partialFilterExpression: { status: "PENDING" } }
);
schema.index({ memberId: 1, createdAt: -1 });

module.exports = mongoose.model("MembershipOrder", schema);
