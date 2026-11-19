const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: "MembershipPlan", required: true },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  startsAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  status: { type: String, enum: ["ACTIVE", "CANCELLED"], default: "ACTIVE" },
  // Set once the "plan expiring soon" reminder has been sent.
  expiryReminderSentAt: { type: Date, default: null },
},{ timestamps: true, collection: "memberships" });

schema.index({ memberId: 1, status: 1, expiresAt: -1 });

module.exports = mongoose.model("Membership", schema);
