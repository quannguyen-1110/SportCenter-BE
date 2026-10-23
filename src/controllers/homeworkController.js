const mongoose = require("mongoose");

const Homework = require("../models/Homework");
const Notification = require("../models/Notification");
const Coach = require("../models/Coach");
const Class = require("../models/Class");
const Member = require("../models/Member");
const ClassRegistration = require("../models/ClassRegistration");

// ==========================================
// CREATE HOMEWORK + SEND NOTIFICATIONS
// POST /api/homeworks
// ==========================================
const createHomework = async (req, res) => {
  try {
    const {
      classId,
      memberId,
      title,
      description,
      dueDate,
      attachments,
    } = req.body;

    // 1. Validate target
    const hasClassId = Boolean(classId);
    const hasMemberId = Boolean(memberId);

    if (hasClassId === hasMemberId) {
      return res.status(400).json({
        success: false,
        message: "Select either classId or memberId, not both.",
      });
    }

    if (hasClassId && !mongoose.isValidObjectId(classId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid classId.",
      });
    }

    if (hasMemberId && !mongoose.isValidObjectId(memberId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid memberId.",
      });
    }

    // 2. Validate homework content
    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 200
    ) {
      return res.status(400).json({
        success: false,
        message: "Title is required and must not exceed 200 characters.",
      });
    }

    if (
      typeof description !== "string" ||
      !description.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Description is required.",
      });
    }

    if (
      dueDate !== undefined &&
      dueDate !== null &&
      dueDate !== "" &&
      Number.isNaN(new Date(dueDate).getTime())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid dueDate.",
      });
    }

    if (
      attachments !== undefined &&
      (!Array.isArray(attachments) ||
        !attachments.every((item) => typeof item === "string"))
    ) {
      return res.status(400).json({
        success: false,
        message: "Attachments must be an array of strings.",
      });
    }

    // 3. Find the coach from the authenticated user.
    // Never trust coachId sent from the client.
    const coach = await Coach.findOne({
      userId: req.user.userId,
    });

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach profile not found.",
      });
    }

    let targetMembers = [];

    // 4. Assign homework to a class
    if (hasClassId) {
      const classData = await Class.findById(classId);

      if (!classData) {
        return res.status(404).json({
          success: false,
          message: "Class not found.",
        });
      }

      // A coach can only assign homework to their own class.
      if (
        !classData.coachId ||
        classData.coachId.toString() !== coach._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You can only assign homework to your own class.",
        });
      }

      // Only confirmed registrations receive class homework.
      const registrations = await ClassRegistration.find({
        classId: classData._id,
        status: "CONFIRMED",
      }).populate("memberId", "userId fullName");

      targetMembers = registrations
        .map((registration) => registration.memberId)
        .filter((member) => member && member.userId);
    }

    // 5. Assign homework to one specific member
    if (hasMemberId) {
      const member = await Member.findById(memberId);

      if (!member) {
        return res.status(404).json({
          success: false,
          message: "Member not found.",
        });
      }

      // Find the class managed by this coach.
      const coachClass = await Class.findOne({
        coachId: coach._id,
      });

      if (!coachClass) {
        return res.status(403).json({
          success: false,
          message: "You are not assigned to a class.",
        });
      }

      // The member must have a confirmed registration in this class.
      const registration = await ClassRegistration.findOne({
        classId: coachClass._id,
        memberId: member._id,
        status: "CONFIRMED",
      });

      if (!registration) {
        return res.status(403).json({
          success: false,
          message:
            "You can only assign homework to a confirmed member of your class.",
        });
      }

      if (!member.userId) {
        return res.status(400).json({
          success: false,
          message: "This member is not linked to a user account.",
        });
      }

      targetMembers = [member];
    }

    // 6. Create homework
    const homework = await Homework.create({
      coachId: coach._id,
      classId: hasClassId ? classId : null,
      memberId: hasMemberId ? memberId : null,
      title: title.trim(),
      description: description.trim(),
      dueDate: dueDate || null,
      attachments: attachments || [],
    });

    // 7. Generate notifications for recipients
    const dueDateText = dueDate
      ? ` Deadline: ${new Date(dueDate).toLocaleDateString("vi-VN")}.`
      : "";

    const notificationDocs = targetMembers.map((member) => ({
      userId: member.userId,
      title: "Bài tập mới",
      message: `Huấn luyện viên đã giao bài tập "${title.trim()}".${dueDateText}`,
    }));

    if (notificationDocs.length > 0) {
      await Notification.insertMany(notificationDocs);
    }

    return res.status(201).json({
      success: true,
      message: "Homework created successfully.",
      data: {
        homework,
        recipientCount: targetMembers.length,
        notificationCount: notificationDocs.length,
      },
    });
  } catch (error) {
    console.error("Create homework error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create homework.",
    });
  }
};

// ==========================================
// GET MY HOMEWORKS
// GET /api/homeworks/my
// ==========================================
const getMyHomeworks = async (req, res) => {
  try {
    let homeworks = [];

    // Coach xem các bài tập do mình giao.
    if (req.user.role === "COACH") {
      const coach = await Coach.findOne({
        userId: req.user.userId,
      });

      if (!coach) {
        return res.status(404).json({
          success: false,
          message: "Coach profile not found.",
        });
      }

      homeworks = await Homework.find({
        coachId: coach._id,
        status: "ACTIVE",
      }).sort({ createdAt: -1 });
    }

    // Member xem bài tập cá nhân và bài tập của lớp đã xác nhận.
    else if (req.user.role === "MEMBER") {
      const member = await Member.findOne({
        userId: req.user.userId,
      });

      if (!member) {
        return res.status(404).json({
          success: false,
          message: "Member profile not found.",
        });
      }

      const registrations = await ClassRegistration.find({
        memberId: member._id,
        status: "CONFIRMED",
      }).select("classId");

      const classIds = registrations.map(
        (registration) => registration.classId
      );

      const conditions = [
        { memberId: member._id },
      ];

      if (classIds.length > 0) {
        conditions.push({
          classId: { $in: classIds },
        });
      }

      homeworks = await Homework.find({
        status: "ACTIVE",
        $or: conditions,
      })
        .populate("coachId")
        .populate("classId")
        .sort({ createdAt: -1 });
    } else {
      return res.status(403).json({
        success: false,
        message: "Your role cannot view these homeworks.",
      });
    }

    return res.status(200).json({
      success: true,
      count: homeworks.length,
      data: homeworks,
    });
  } catch (error) {
    console.error("Get my homeworks error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve homeworks.",
    });
  }
};

module.exports = {
  createHomework,
  getMyHomeworks,
};