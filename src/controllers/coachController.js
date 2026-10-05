const Coach = require("../models/Coach");
const User = require("../models/User");

// CREATE coach
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
      fullName: fullName.trim(),
      phone: phone.trim(),
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

// GET all coaches
const getCoaches = async (req, res) => {
  try {
    const coaches = await Coach.find()
      .select("_id userId fullName phone createdAt updatedAt")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Coaches retrieved successfully",
      data: coaches,
    });
  } catch (error) {
    console.error("Get coaches error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// UPDATE coach
const updateCoach = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phone } = req.body;

    if (!fullName || !phone) {
      return res.status(400).json({
        success: false,
        message: "fullName and phone are required",
      });
    }

    const coach = await Coach.findById(id);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    coach.fullName = fullName.trim();
    coach.phone = phone.trim();

    await coach.save();

    return res.status(200).json({
      success: true,
      message: "Coach updated successfully",
      data: {
        id: coach._id,
        userId: coach.userId,
        fullName: coach.fullName,
        phone: coach.phone,
      },
    });
  } catch (error) {
    console.error("Update coach error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE coach
const deleteCoach = async (req, res) => {
  try {
    const { id } = req.params;

    const coach = await Coach.findById(id);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    await Coach.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Coach deleted successfully",
    });
  } catch (error) {
    console.error("Delete coach error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createCoach,
  getCoaches,
  updateCoach,
  deleteCoach,
};