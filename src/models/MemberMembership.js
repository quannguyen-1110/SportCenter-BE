const mongoose = require("mongoose");

const memberMembershipSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },

    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MembershipPackage",
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "memberMemberships",
  }
);

module.exports = mongoose.model(
  "MemberMembership",
  memberMembershipSchema
);