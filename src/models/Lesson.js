const mongoose = require("mongoose");

function isValidVideoUrl(value) {
  if (typeof value !== "string") return false;
  const link = value.trim();
  if (!link) return true;
  if (!/^https?:\/\//i.test(link)) return false;
  try {
    return Boolean(new URL(link).hostname);
  } catch {
    return false;
  }
}

const lessonSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null,
    },

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

    videoUrl: {
      type: String,
      trim: true,
      default: "",
      validate: { validator: isValidVideoUrl, message: "videoUrl must be an HTTP or HTTPS URL" },
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

lessonSchema.index({ classId: 1, order: 1 });
lessonSchema.statics.isValidVideoUrl = isValidVideoUrl;

module.exports = mongoose.model("Lesson", lessonSchema);
