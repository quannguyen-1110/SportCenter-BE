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