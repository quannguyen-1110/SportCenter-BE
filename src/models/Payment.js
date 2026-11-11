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

    // Set by the Web/Mobile creation endpoint; never accepted by updatePayment.
    paymentProvider: {
      type: String,
      enum: ["VNPAY", "PAYOS"],
      required: function () { return this.isNew && this.paymentMethod === "ONLINE"; },
    },

    paymentDate: {
      type: Date,
      default: null,
    },
    payosOrderCode: { type: Number, unique: true, sparse: true },
    payosCheckoutUrl: String,
    vnpayUrl: { type: String, select: false },
    vnpayExpiresAt: { type: Date, select: false },
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

paymentSchema.statics.providerOf = function (payment) {
  if (payment.paymentMethod !== "ONLINE") return undefined;
  return payment.paymentProvider || (payment.payosOrderCode != null ? "PAYOS" : "VNPAY");
};

// Exclude the other gateway's metadata, even if a record is incorrectly tagged.
// Untagged legacy payments are payOS only when an order code already exists.
paymentSchema.statics.providerFilter = function (provider) {
  if (!["VNPAY", "PAYOS"].includes(provider)) throw new Error("Unknown payment provider");
  const isPayos = provider === "PAYOS";
  return {
    paymentMethod: "ONLINE",
    ...(isPayos
      ? { vnpayUrl: { $exists: false }, vnpayExpiresAt: { $exists: false } }
      : { payosOrderCode: { $exists: false }, payosCheckoutUrl: { $exists: false } }),
    $or: [
      { paymentProvider: provider },
      { paymentProvider: { $exists: false }, payosOrderCode: { $exists: isPayos } },
    ],
  };
};

module.exports = mongoose.model("Payment", paymentSchema);
