const mongoose = require("mongoose");

// One visit to the center: opened when the front desk confirms "vào", closed on "ra".
const schema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  // What gave access at check-in: confirmed class registrations still running, and/or a membership.
  classRegistrationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "ClassRegistration" }],
  membershipId: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", default: null },
  status: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN" },
  checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  checkedInAt: { type: Date, required: true },
  checkedOutBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  checkedOutAt: { type: Date, default: null },
  // The single-use QR tokens that opened/closed the visit (lets a retried request find its result).
  checkInTokenId: { type: mongoose.Schema.Types.ObjectId, ref: "CheckInToken", default: null },
  checkOutTokenId: { type: mongoose.Schema.Types.ObjectId, ref: "CheckInToken", default: null },
  method: { type: String, enum: ["QR"], default: "QR" },
}, { timestamps: true, collection: "checkIns" });

schema.index({ memberId: 1, checkedInAt: -1 });
schema.index({ checkedInAt: -1 });
// At most one open visit per member: a second "vào" while inside fails here, even under races.
// Older records written before check-out existed have no status and are not covered.
schema.index({ memberId: 1 }, { unique: true, partialFilterExpression: { status: "OPEN" }, name: "one_open_visit_per_member" });

module.exports = mongoose.model("CheckIn", schema);
