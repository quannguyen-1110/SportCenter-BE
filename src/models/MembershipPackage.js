const mongoose = require("mongoose");

const membershipPackageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    duration: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    timestamps: true,
    collection: "membershipPackages",
  }
);

module.exports = mongoose.model(
  "MembershipPackage",
  membershipPackageSchema
);