const mongoose = require("mongoose");

const workoutPlanSchema = new mongoose.Schema(
  {
    coachId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coach",
      required: true,
    },

    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },

    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null,
    },

    goal: {
      type: String,
      required: true,
      trim: true,
    },

    level: {
      type: String,
      enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
      required: true,
    },

    plan: {
      type: String,
      required: true,
      trim: true,
    },

    source: {
      type: String,
      enum: ["COACH", "AI"],
      default: "COACH",
    },

    status: {
      type: String,
      enum: ["DRAFT", "APPROVED"],
      default: "DRAFT",
    },
  },
  {
    timestamps: true,
    collection: "workoutPlans",
  }
);

module.exports = mongoose.model("WorkoutPlan", workoutPlanSchema);