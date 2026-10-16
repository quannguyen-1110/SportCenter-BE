const mongoose = require("mongoose");

const workoutPlanSchema = new mongoose.Schema(
  {
    coachId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coach",
      required: true,
    },

    // Kế hoạch cá nhân có memberId.
    // Kế hoạch chung cho lớp có thể để memberId = null.
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      default: null,
    },

    // Kế hoạch chung cho lớp cần classId.
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

// Hỗ trợ truy vấn kế hoạch của Coach theo thời gian tạo.
workoutPlanSchema.index({ coachId: 1, createdAt: -1 });

module.exports = mongoose.model("WorkoutPlan", workoutPlanSchema);