const mongoose = require("mongoose");

const coachSchema = new mongoose.Schema(
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
    subjectIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }],
      default: undefined,
      required: true,
      castNonArrays: false,
      validate: {
        validator: value => Array.isArray(value) && value.length === 1,
        message: "Each coach must have exactly one subject in subjectIds",
      },
    },
  },
  {
    timestamps: true,
    collection: "coaches",
  }
);

module.exports = mongoose.model("Coach", coachSchema);
