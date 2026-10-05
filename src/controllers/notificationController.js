const Notification = require("../models/Notification");
const User = require("../models/User");

const createNotification = async (req, res) => {
  try {
    const { userId, title, message } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "userId, title and message are required",
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

// Get all notifications
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find()
      .populate(
        "userId",
        "email role status"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully",
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

module.exports = {
  createNotification,
  getNotifications,
};