
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const User = require("../models/User");
const Class = require("../models/Class");
const ClassRegistration = require("../models/ClassRegistration");
const Coach = require("../models/Coach");
const Member = require("../models/Member");
const { notifyUsers, classMemberUserIds } = require("../services/notificationService");

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

// ==========================================
// COACH SENDS A NOTIFICATION
// POST /api/notifications/coach
// Body: { classId? , memberId?, title, message }
// A coach may only reach classes they teach and members confirmed in those classes.
// ==========================================
const sendCoachNotification = async (req, res) => {
  try {
    const { classId, memberId, title, message } = req.body ?? {};

    if (Boolean(classId) === Boolean(memberId)) {
      return res.status(400).json({ success: false, message: "Provide exactly one of classId or memberId" });
    }
    if ((classId && !mongoose.isValidObjectId(classId)) || (memberId && !mongoose.isValidObjectId(memberId))) {
      return res.status(400).json({ success: false, message: "Invalid classId or memberId" });
    }
    if (typeof title !== "string" || !title.trim() || title.length > 200
        || typeof message !== "string" || !message.trim() || message.length > 2000) {
      return res.status(400).json({ success: false, message: "Title and message are required" });
    }

    const coach = await Coach.findOne({ userId: req.user.userId }).select("_id fullName").lean();
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }
    const classIds = (await Class.find({ coachId: coach._id }).select("_id").lean()).map((item) => String(item._id));

    let userIds;
    if (classId) {
      if (!classIds.includes(String(classId))) {
        return res.status(403).json({ success: false, message: "You do not teach this class" });
      }
      userIds = await classMemberUserIds(classId);
    } else {
      const enrolled = await ClassRegistration.exists({ memberId, classId: { $in: classIds }, status: "CONFIRMED" });
      const member = enrolled && await Member.findById(memberId).select("userId").lean();
      if (!member) {
        return res.status(403).json({ success: false, message: "This member is not in your classes" });
      }
      userIds = [member.userId];
    }

    const sent = await notifyUsers(userIds, title.trim(), `${message.trim()}\n— HLV ${coach.fullName}`);

    return res.status(201).json({ success: true, message: "Notification sent", data: { recipients: sent } });
  } catch (error) {
    console.error("Coach notification error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ==========================================
// MARK ALL MY NOTIFICATIONS AS READ
// PUT /api/notifications/my/read-all
// ==========================================
const markAllMyNotificationsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany({ userId: req.user.userId, isRead: false }, { $set: { isRead: true } });
    return res.json({ success: true, data: { updated: result.modifiedCount } });
  } catch (error) {
    console.error("Mark all read error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  sendCoachNotification,
  markAllMyNotificationsRead,
  createNotification,
  getNotifications,
  getMyNotifications,
  updateNotification,
};
