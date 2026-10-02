const mongoose = require("mongoose");

const lessonSchema = new mongoose.Schema(
  {
    learningPathId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LearningPath",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    order: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    timestamps: true,
    collection: "lessons",
  }
);

module.exports = mongoose.model("Lesson", lessonSchema);