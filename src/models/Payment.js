const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    classRegistrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassRegistration",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentMethod: {
      type: String,
      enum: ["CASH", "BANK_TRANSFER", "ONLINE"],
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "PENDING",
    },

    paymentDate: {
      type: Date,
      default: null,
    },
    payosOrderCode: { type: Number, unique: true, sparse: true },
    payosCheckoutUrl: String,
  },
  {
    timestamps: true,
    collection: "payments",
  }
);

paymentSchema.index(
  { classRegistrationId: 1 },
  { unique: true, partialFilterExpression: { status: "PENDING", payosOrderCode: { $exists: true } } }
);

module.exports = mongoose.model("Payment", paymentSchema);
