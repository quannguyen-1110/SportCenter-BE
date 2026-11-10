
const mongoose = require("mongoose");

const ClassRegistration = require("../models/ClassRegistration");
const Class = require("../models/Class");
const Course = require("../models/Course");
const Member = require("../models/Member");
const Payment = require("../models/Payment");

const VALID_REGISTRATION_STATUSES = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "CANCELLED",
];

const isValidId = (id) => mongoose.isValidObjectId(id);

// Every student pays the course tuition independently of the other registrations.
const getClassPrice = async classData => {
  const course = await Course.findById(classData.courseId);
  if (!course) return { success: false, statusCode: 404, message: "Course not found" };
  const price = Course.tuitionOf(course);
  if (price === undefined) {
    return { success: false, statusCode: 400, message: "Course tuition has not been configured" };
  }
  return { success: true, price };
};

// POST /api/class-registrations
const registerClass = async (req, res) => {
  try {
    const { classId, memberId } = req.body;

    // Validate classId
    if (!classId || !isValidId(classId)) {
      return res.status(400).json({
        success: false,
        message: "A valid classId is required",
      });
    }

    // Find class
    const classData = await Class.findById(classId);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Find target member
    let targetMember;

    if (req.user.role === "MEMBER") {
      targetMember = await Member.findOne({
        userId: req.user.userId,
      });

      if (!targetMember) {
        return res.status(404).json({
          success: false,
          message: "Member profile not found",
        });
      }

      if (
        memberId &&
        (
          !isValidId(memberId) ||
          memberId.toString() !== targetMember._id.toString()
        )
      ) {
        return res.status(403).json({
          success: false,
          message: "You can only register yourself",
        });
      }
    } else {
      if (!memberId || !isValidId(memberId)) {
        return res.status(400).json({
          success: false,
          message: "A valid memberId is required",
        });
      }

      targetMember = await Member.findById(memberId);

      if (!targetMember) {
        return res.status(404).json({
          success: false,
          message: "Member not found",
        });
      }
    }

    // Get the per-student tuition from the course.
    // Never accept price from frontend.
    const priceResult = await getClassPrice(classData);

    if (!priceResult.success) {
      return res.status(priceResult.statusCode).json({
        success: false,
        message: priceResult.message,
      });
    }

    // Check existing registration
    const existingRegistration =
      await ClassRegistration.findOne({
        classId,
        memberId: targetMember._id,
      });

    if (
      existingRegistration &&
      existingRegistration.status !== "CANCELLED"
    ) {
      return res.status(409).json({
        success: false,
        message: "Member is already registered for this class",
      });
    }

    // Reactivate a cancelled registration if it has no payment history.
    if (existingRegistration) {
      const previousPayment = await Payment.exists({
        classRegistrationId: existingRegistration._id,
      });

      if (previousPayment) {
        return res.status(409).json({
          success: false,
          message:
            "This cancelled registration has payment history. Please contact staff to register again.",
        });
      }

      existingRegistration.status = "PENDING_PAYMENT";
      existingRegistration.priceSnapshot = priceResult.price;
      existingRegistration.registeredAt = new Date();

      await existingRegistration.save();

      return res.status(200).json({
        success: true,
        message:
          "Cancelled registration reactivated. Payment is required to confirm the registration.",
        data: existingRegistration,
      });
    }

    // Create new registration with price snapshot
    const registration = await ClassRegistration.create({
      classId,
      memberId: targetMember._id,
      status: "PENDING_PAYMENT",
      priceSnapshot: priceResult.price,
      registeredAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message:
        "Class registration created. Payment is required to confirm the registration.",
      data: registration,
    });
  } catch (error) {
    console.error("Register class error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Member is already registered for this class",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET /api/class-registrations
const getClassRegistrations = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === "MEMBER") {
      const member = await Member.findOne({ userId: req.user.userId }).select("_id");
      if (!member) {
        return res.status(404).json({ success: false, message: "Member profile not found" });
      }
      filter.memberId = member._id;
    }
    const registrations = await ClassRegistration.find(filter)
      .populate("memberId", "fullName phone goal level")
      .populate({
        path: "classId",
        select: "name subjectId courseId coachId",
        populate: {
          path: "courseId",
          select: "name price pricing",
        },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Class registrations retrieved successfully",
      data: registrations,
    });
  } catch (error) {
    console.error("Get class registrations error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// PUT /api/class-registrations/:id
const updateClassRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const { classId, memberId, status } = req.body;

    // Validate registration ID
    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid class registration ID",
      });
    }

    // Validate status
    if (
      status !== undefined &&
      !VALID_REGISTRATION_STATUSES.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid class registration status",
      });
    }

    const registration = await ClassRegistration.findById(id);

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Class registration not found",
      });
    }

    // MEMBER can only cancel their own registration.
    if (req.user.role === "MEMBER") {
      const ownMember = await Member.findOne({
        userId: req.user.userId,
      });

      if (!ownMember) {
        return res.status(404).json({
          success: false,
          message: "Member profile not found",
        });
      }

      if (
        registration.memberId.toString() !==
        ownMember._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You cannot update another member's registration",
        });
      }

      if (status === "CONFIRMED") {
        return res.status(403).json({
          success: false,
          message:
            "Members cannot confirm registrations directly. Confirmation must be performed by the payment flow.",
        });
      }

      if (status !== undefined && status !== "CANCELLED") {
        return res.status(403).json({
          success: false,
          message:
            "Members can only cancel their own registration",
        });
      }

      if (
        (
          classId &&
          (
            !isValidId(classId) ||
            classId.toString() !== registration.classId.toString()
          )
        ) ||
        (
          memberId &&
          (
            !isValidId(memberId) ||
            memberId.toString() !== registration.memberId.toString()
          )
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Members cannot change the class or member of a registration",
        });
      }
    }

    // Determine new class and member
    const newClassId = classId || registration.classId;
    const newMemberId = memberId || registration.memberId;

    if (
      !isValidId(newClassId) ||
      !isValidId(newMemberId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid classId or memberId",
      });
    }

    const classData = await Class.findById(newClassId);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    const member = await Member.findById(newMemberId);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    const classChanged =
      newClassId.toString() !== registration.classId.toString();

    const memberChanged =
      newMemberId.toString() !== registration.memberId.toString();

    // Do not change class/member after payment has been created.
    if (classChanged || memberChanged) {
      const existingPayment = await Payment.exists({
        classRegistrationId: registration._id,
      });

      if (existingPayment) {
        return res.status(409).json({
          success: false,
          message:
            "Cannot change class or member after a payment has been created",
        });
      }
    }

    // Check duplicate registration
    const duplicateRegistration =
      await ClassRegistration.findOne({
        classId: newClassId,
        memberId: newMemberId,
        _id: { $ne: registration._id },
      });

    if (duplicateRegistration) {
      return res.status(409).json({
        success: false,
        message: "Member is already registered for this class",
      });
    }

    const newStatus =
      status !== undefined ? status : registration.status;

    if (newStatus === "CANCELLED" && registration.status !== "CANCELLED" &&
        await Payment.exists({ classRegistrationId: registration._id, status: "PENDING", payosOrderCode: { $exists: true } })) {
      return res.status(409).json({
        success: false,
        message: "Hãy hủy yêu cầu trên trang payOS hoặc đợi link hết hạn, rồi kiểm tra trạng thái thanh toán trước khi hủy đăng ký.",
      });
    }

    // Staff cannot confirm without a successful payment.
    if (newStatus === "CONFIRMED") {
      const successfulPayment = await Payment.exists({
        classRegistrationId: registration._id,
        status: "SUCCESS",
      });

      if (!successfulPayment) {
        return res.status(400).json({
          success: false,
          message:
            "Registration requires a successful payment before confirmation",
        });
      }
    }

    // If the class changes, recalculate the snapshot price.
    // This is allowed only when no payment exists.
    if (classChanged || registration.priceSnapshot === undefined) {
      const priceResult = await getClassPrice(classData);

      if (!priceResult.success) {
        return res.status(priceResult.statusCode).json({
          success: false,
          message: priceResult.message,
        });
      }

      registration.priceSnapshot = priceResult.price;
    }

    registration.classId = newClassId;
    registration.memberId = newMemberId;
    registration.status = newStatus;

    await registration.save();

    return res.status(200).json({
      success: true,
      message: "Class registration updated successfully",
      data: registration,
    });
  } catch (error) {
    console.error("Update class registration error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Member is already registered for this class",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  registerClass,
  getClassRegistrations,
  updateClassRegistration,
};
