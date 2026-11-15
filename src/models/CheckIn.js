const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  membershipId: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", required: true },
  checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  checkedInAt: { type: Date, required: true },
  method: { type: String, enum: ["QR"], default: "QR" },
}, { timestamps: true, collection: "checkIns" });

schema.index({ memberId: 1, checkedInAt: -1 });

module.exports = mongoose.model("CheckIn", schema);
