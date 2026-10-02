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
  }
);

module.exports = mongoose.model("Schedule", scheduleSchema);