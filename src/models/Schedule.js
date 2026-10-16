const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema(
  {
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

    // Phòng học của buổi học này
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    startTime: {
      type: String,
      required: true,
    },

    endTime: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["SCHEDULED", "COMPLETED", "CANCELLED"],
      default: "SCHEDULED",
    },
  },
  {
    timestamps: true,
    collection: "schedules",
  }
);

// Hỗ trợ truy vấn lịch theo phòng, ngày và giờ
scheduleSchema.index({
  roomId: 1,
  date: 1,
  startTime: 1,
});

module.exports = mongoose.model("Schedule", scheduleSchema);