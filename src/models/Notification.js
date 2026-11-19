const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    isRead: {
      type: Boolean,
      default: false,
    },
    // Who sent it: the manager / receptionist / coach account; null for automatic notifications
    // (reminders, registration and payment updates).
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    eventKey: { type: String, unique: true, sparse: true, select: false },
  },
  {
    timestamps: true,
    collection: "notifications",
  }
);

module.exports = mongoose.model(
  "Notification",
  notificationSchema
);
