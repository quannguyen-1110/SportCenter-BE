const Coach = require("../models/Coach");
const User = require("../models/User");

const createCoach = async (req, res) => {
  try {
    const { userId, fullName, phone } = req.body;

    if (!userId || !fullName || !phone) {
      return res.status(400).json({
        success: false,
        message: "userId, fullName and phone are required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role !== "COACH") {
      return res.status(400).json({
        success: false,
        message: "User role must be COACH",
      });
    }

    const existingCoach = await Coach.findOne({ userId });

    if (existingCoach) {
      return res.status(409).json({
        success: false,
        message: "Coach profile already exists",
      });
    }

    const coach = await Coach.create({
      userId,
      fullName,
      phone,
    });

    return res.status(201).json({
      success: true,
      message: "Coach created successfully",
      data: {
        id: coach._id,
        userId: coach.userId,
        fullName: coach.fullName,
        phone: coach.phone,
      },
    });
  } catch (error) {
    console.error("Create coach error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createCoach,
};