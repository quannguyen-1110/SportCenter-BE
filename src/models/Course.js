
const mongoose = require("mongoose");

const pricingSchema = new mongoose.Schema(
  {
    personal: {
      type: Number,
      required: true,
      min: 0,
    },
    group: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const courseSchema = new mongoose.Schema(
  {
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    // One-time price for the entire course
    pricing: {
      type: pricingSchema,
      required: true,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
    collection: "courses",
  }
);

module.exports = mongoose.model("Course", courseSchema);
