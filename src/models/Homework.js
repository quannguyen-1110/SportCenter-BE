
const mongoose = require("mongoose");

const homeworkSchema = new mongoose.Schema(
  {
    coachId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coach",
      required: true,
    },

    // Giao cho cả lớp hoặc một học viên cụ thể.
    // Chỉ được chọn một trong hai trường này.
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null,
    },

    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      default: null,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    dueDate: {
      type: Date,
      default: null,
    },

    attachments: {
      type: [String],
      default: [],
    },

    status: {
      type: String,
      enum: ["ACTIVE", "ARCHIVED"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
    collection: "homeworks",
  }
);

// Mỗi bài tập phải dành cho một lớp hoặc một học viên.
homeworkSchema.pre("validate", function () {
  const hasClass = Boolean(this.classId);
  const hasMember = Boolean(this.memberId);

  if (hasClass === hasMember) {
    this.invalidate(
      "classId",
      "A homework must target either one class or one member"
    );
  }
});

homeworkSchema.index({ coachId: 1, createdAt: -1 });
homeworkSchema.index({ classId: 1, createdAt: -1 });
homeworkSchema.index({ memberId: 1, createdAt: -1 });

module.exports = mongoose.model("Homework", homeworkSchema);
