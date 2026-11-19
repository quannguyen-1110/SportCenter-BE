const mongoose = require("mongoose");

const ActivityLog = require("../models/ActivityLog");
const User = require("../models/User");

const createActivityLog = async (req, res) => {
  try {
    const { action } = req.body;
    const userId = req.user.userId;

    if (typeof action !== "string" || !action.trim() || action.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "userId and action are required",
      });
    }

    if (!mongoose.isValidObjectId(userId) || typeof action !== "string" || !action.trim()) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId or action",
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
      role: user.role,
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

// GET /api/activity-logs?userId=&role=&from=&to=&page=1&limit=50
const getActivityLogs = async (req, res) => {
  try {
    const { userId, role, from, to } = req.query;
    const filter = {};

    if (userId) {
      if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ success: false, message: "Invalid userId" });
      }
      filter.userId = userId;
    }

    if (role) filter.role = String(role);

    if (from || to) {
      const start = from ? new Date(from) : null;
      const end = to ? new Date(to) : null;
      if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) {
        return res.status(400).json({ success: false, message: "Invalid from/to date" });
      }
      filter.createdAt = {};
      if (start) filter.createdAt.$gte = start;
      if (end) filter.createdAt.$lte = end;
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));

    const [total, activityLogs] = await Promise.all([
      ActivityLog.countDocuments(filter),
      ActivityLog.find(filter)
        .populate("userId", "email fullName role status")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      message: "Activity logs retrieved successfully",
      pagination: { page, limit, total },
      data: activityLogs,
    });
  } catch (error) {
    console.error("Get activity logs error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createActivityLog,
  getActivityLogs,
};
