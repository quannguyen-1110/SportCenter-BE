const ClassRegistration = require("../models/ClassRegistration");
const Class = require("../models/Class");
const Member = require("../models/Member");

const registerClass = async (req, res) => {
  try {
    const { classId, memberId } = req.body;

    // Validate required fields
    if (!classId || !memberId) {
      return res.status(400).json({
        success: false,
        message: "classId and memberId are required",
      });
    }

    // Check class
    const classData = await Class.findById(classId);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Check member
    const member = await Member.findById(memberId);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    // Check existing registration
    const existingRegistration =
      await ClassRegistration.findOne({
        classId,
        memberId,
      });

    if (existingRegistration) {
      return res.status(409).json({
        success: false,
        message: "Member is already registered for this class",
      });
    }

    // Create registration with pending payment status
    const registration = await ClassRegistration.create({
      classId,
      memberId,
      status: "PENDING_PAYMENT",
      registeredAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message:
        "Class registration created. Payment is required to confirm the registration.",
      data: {
        id: registration._id,
        classId: registration.classId,
        memberId: registration.memberId,
        status: registration.status,
        registeredAt: registration.registeredAt,
        createdAt: registration.createdAt,
      },
    });
  } catch (error) {
    console.error("Register class error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  registerClass,
};