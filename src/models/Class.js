const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    // GROUP accepts multiple registrations; PERSONAL accepts one active registration.
    classType: {
      type: String,
      enum: ["GROUP", "PERSONAL"],
      default: "GROUP",
      required: true,
    },
    // Preserved existing business rule: a coach can be assigned to one class only.
    coachId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coach",
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
    collection: "classes",
  }
);

module.exports = mongoose.model("Class", classSchema);
