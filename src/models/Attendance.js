const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },

    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },

    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["PRESENT", "ABSENT"],
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "attendances",
  }
);

// Một member chỉ có một bản ghi điểm danh
// cho một class + lesson trong cùng một ngày
attendanceSchema.index(
  { memberId: 1, classId: 1, lessonId: 1, date: 1 },
  { unique: true }
);

module.exports = mongoose.model("Attendance", attendanceSchema);