const mongoose = require("mongoose");

const classRegistrationSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },

    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "classRegistrations",
  }
);

// Một member không được đăng ký cùng một class nhiều lần
classRegistrationSchema.index(
  { classId: 1, memberId: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "ClassRegistration",
  classRegistrationSchema
);