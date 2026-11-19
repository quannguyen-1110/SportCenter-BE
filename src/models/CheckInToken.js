const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true, select: false },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  usedAt: { type: Date, default: null },
}, { timestamps: true, collection: "checkInTokens" });

module.exports = mongoose.model("CheckInToken", schema);
