const mongoose = require("mongoose");

const lessonProgressSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },

    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
    },

    status: {
      type: String,
      enum: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"],
      default: "NOT_STARTED",
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "lessonProgress",
  }
);

// Một member chỉ có một progress cho một lesson
lessonProgressSchema.index(
  { memberId: 1, lessonId: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "LessonProgress",
  lessonProgressSchema
);