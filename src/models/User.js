const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
fullName: {
  type: String,
  trim: true,
  default: "",
},

phone: {
  type: String,
  trim: true,
  default: "",
},
    passwordHash: {
  type: String,
  required: function () {
    return this.authProvider !== "GOOGLE";
  },
  select: false,
},
authProvider: {
  type: String,
  enum: ["LOCAL", "GOOGLE"],
  default: "LOCAL",
},
googleId: {
  type: String,
  unique: true,
  sparse: true,
},

googleOtpVerified: {
  type: Boolean,
  default: false,
},

    role: {
      type: String,
      required: true,
      enum: [
        "CENTER_MANAGER",
        "COACH",
        "MEMBER",
        "RECEPTIONIST",
      ],
    },

    resetTokenHash: { type: String, select: false, index: { sparse: true } },
    resetExpiresAt: { type: Date, select: false },
    resetRequestedAt: { type: Date, select: false },
    sessionVersion: { type: Number, default: 0, select: false },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
    collection: "users",
  }
);

module.exports = mongoose.model("User", userSchema);