const mongoose = require("mongoose");

const workoutResultSchema = new mongoose.Schema(
  {
    workoutPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkoutPlan",
      required: true,
    },

    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },

    result: {
      type: String,
      required: true,
      trim: true,
    },

    comment: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
    collection: "workoutResults",
  }
);

module.exports = mongoose.model(
  "WorkoutResult",
  workoutResultSchema
);