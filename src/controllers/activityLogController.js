const ActivityLog = require("../models/ActivityLog");
const User = require("../models/User");

const createActivityLog = async (req, res) => {
  try {
    const { userId, action } = req.body;

    if (!userId || !action) {
      return res.status(400).json({
        success: false,
        message: "userId and action are required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const activityLog = await ActivityLog.create({
      userId,
      action: action.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Activity log created successfully",
      data: {
        id: activityLog._id,
        userId: activityLog.userId,
        action: activityLog.action,
        createdAt: activityLog.createdAt,
      },
    });
  } catch (error) {
    console.error("Create activity log error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createActivityLog,
};