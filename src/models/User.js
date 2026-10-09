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