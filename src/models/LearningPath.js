const mongoose = require("mongoose");

const learningPathSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
    collection: "learningPaths",
  }
);

const LearningPath = mongoose.model(
  "LearningPath",
  learningPathSchema
);

module.exports = LearningPath;