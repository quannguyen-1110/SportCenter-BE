const mongoose = require("mongoose");

const supportRequestSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "RESOLVED"],
      default: "PENDING",
    },
    handlingNotes: [{
      text: { type: String, required: true, maxlength: 2000 },
      staffId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      createdAt: { type: Date, default: Date.now },
    }],
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: "supportRequests",
  }
);

module.exports = mongoose.model(
  "SupportRequest",
  supportRequestSchema
);
