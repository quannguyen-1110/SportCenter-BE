
const mongoose = require("mongoose");

const classRegistrationSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },

    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING_PAYMENT", "CONFIRMED", "CANCELLED"],
      default: "PENDING_PAYMENT",
    },

    // Course price at the time the member registers
    priceSnapshot: {
      type: Number,
      required: true,
      min: 0,
    },

    registeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "classRegistrations",
  }
);

// A member cannot register for the same class more than once
classRegistrationSchema.index(
  { classId: 1, memberId: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "ClassRegistration",
  classRegistrationSchema
);
