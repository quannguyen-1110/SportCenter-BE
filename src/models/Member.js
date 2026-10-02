const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    goal: {
      type: String,
      required: true,
      trim: true,
    },

    level: {
      type: String,
      enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
      default: "BEGINNER",
    },
  },
  {
    timestamps: true,
    collection: "members",
  }
);

module.exports = mongoose.model("Member", memberSchema);