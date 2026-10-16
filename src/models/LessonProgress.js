
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

    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
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

    coachComment: {
      type: String,
      trim: true,
      default: "",
    },

    evaluatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "lessonProgress",
  }
);

lessonProgressSchema.index(
  { memberId: 1, lessonId: 1, classId: 1 },
  { unique: true }
);

module.exports = mongoose.model("LessonProgress", lessonProgressSchema);
