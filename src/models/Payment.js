const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    memberMembershipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MemberMembership",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentDate: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "payments",
  }
);

module.exports = mongoose.model("Payment", paymentSchema);