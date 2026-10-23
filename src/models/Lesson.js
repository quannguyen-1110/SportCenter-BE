
const mongoose = require("mongoose");

const lessonSchema = new mongoose.Schema(
  {
    // Lớp mà buổi học này thuộc về.
    // Để null trong giai đoạn chuyển đổi dữ liệu cũ.
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null,
      index: true,
    },

    // Giữ quan hệ LearningPath hiện tại.
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

// Tra cứu các buổi học của một lớp theo thứ tự.
lessonSchema.index({ classId: 1, order: 1 });

module.exports = mongoose.model("Lesson", lessonSchema);
