
const mongoose = require("mongoose");

// Existing two-price records keep their stored data; the former group fee is
// the per-student tuition until a manager saves an explicit price.
const tuitionOf = course => {
  const price = course?.price === undefined ? course?.pricing?.group : course.price;
  return Number.isFinite(price) && price >= 0 ? price : undefined;
};

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

    // One-time tuition for each student attending this course.
    price: {
      type: Number,
      min: 0,
      required: function () { return !Number.isFinite(this.pricing?.group); },
      validate: { validator: value => value === undefined || Number.isFinite(value), message: "price must be finite" },
    },
    // Read compatibility for records created before single-price tuition.
    pricing: {
      type: pricingSchema,
      default: undefined,
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
    toJSON: {
      transform(_document, value) {
        value.price = tuitionOf(value);
        delete value.pricing;
        return value;
      },
    },
  }
);

courseSchema.statics.tuitionOf = tuitionOf;
module.exports = mongoose.model("Course", courseSchema);
