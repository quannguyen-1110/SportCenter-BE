
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const User = require("../models/User");

// ==========================================
// CREATE NOTIFICATION
// POST /api/notifications
// Dùng cho chức năng quản trị tạo thông báo.
// Route cần giới hạn quyền phù hợp.
// ==========================================
const createNotification = async (req, res) => {
  try {
    const { userId, title, message } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "userId, title and message are required",
      });
    }

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId",
      });
    }

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Title and message must be non-empty strings",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const notification = await Notification.create({
      userId,
      title: title.trim(),
      message: message.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: {
        id: notification._id,
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      },
    });
  } catch (error) {
    console.error("Create notification error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ==========================================
// GET ALL NOTIFICATIONS
// GET /api/notifications
// Dùng cho quản trị xem toàn bộ thông báo.
// Route chỉ nên cho phép vai trò quản lý phù hợp.
// ==========================================
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find()
      .populate("userId", "email role status")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully",
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    console.error("Get notifications error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ==========================================
// GET MY NOTIFICATIONS
// GET /api/notifications/my
// Người dùng chỉ xem thông báo của mình.
// ==========================================
const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 });

    const unreadCount = notifications.filter(
      (notification) => !notification.isRead
    ).length;

    return res.status(200).json({
      success: true,
      message: "My notifications retrieved successfully",
      count: notifications.length,
      unreadCount,
      data: notifications,
    });
  } catch (error) {
    console.error("Get my notifications error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ==========================================
// UPDATE MY NOTIFICATION
// PUT /api/notifications/:id
// Người dùng chỉ cập nhật thông báo của mình.
// ==========================================
const updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { isRead } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    if (typeof isRead !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isRead must be a boolean",
      });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        userId: req.user.userId,
      },
      {
        $set: { isRead },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification updated successfully",
      data: {
        id: notification._id,
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update notification error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createNotification,
  getNotifications,
  getMyNotifications,
  updateNotification,
};
