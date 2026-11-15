const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      default: null,
    },
    // Human readable description, e.g. "Cập nhật lịch học".
    action: {
      type: String,
      required: true,
      trim: true,
    },
    method: {
      type: String,
      default: null,
    },
    path: {
      type: String,
      default: null,
    },
    statusCode: {
      type: Number,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "activityLogs",
  }
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model(
  "ActivityLog",
  activityLogSchema
);
