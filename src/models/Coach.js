const mongoose = require("mongoose");

const coachSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    // Mỗi HLV chỉ phụ trách một môn thể thao
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "coaches",
  }
);

module.exports = mongoose.model("Coach", coachSchema);