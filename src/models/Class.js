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
    toJSON: {
      transform(_document, value) {
        delete value.classType;
        return value;
      },
    },
  }
);

module.exports = mongoose.model("Class", classSchema);
