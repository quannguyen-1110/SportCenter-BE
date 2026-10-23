
const mongoose = require("mongoose");

const ClassRegistration = require("../models/ClassRegistration");
const Class = require("../models/Class");
const Member = require("../models/Member");
const Payment = require("../models/Payment");

const VALID_REGISTRATION_STATUSES = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "CANCELLED",
];

const isValidId = (id) => mongoose.isValidObjectId(id);



// CREATE class registration
const registerClass = async (req, res) => {
  try {
    const { classId, memberId } = req.body;

    if (!classId || !isValidId(classId)) {
      return res.status(400).json({
        success: false,
        message: "A valid classId is required",
      });
    }

    const classData = await Class.findById(classId);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    let targetMember;

    // A MEMBER can register only their own account.
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
        (!isValidId(memberId) ||
          memberId.toString() !== targetMember._id.toString())
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

    const existingRegistration = await ClassRegistration.findOne({
  classId,
  memberId: targetMember._id,
});

// Reject duplicate registrations unless the previous one was cancelled.
if (
  existingRegistration &&
  existingRegistration.status !== "CANCELLED"
) {
  return res.status(409).json({
    success: false,
    message: "Member is already registered for this class",
  });
}

// Check capacity for PERSONAL classes.
const capacity = await checkClassCapacity(classData);

if (!capacity.available) {
  return res.status(409).json({
    success: false,
    message: capacity.message,
  });
}

// Reuse a cancelled registration when no payment is linked to it.
// This avoids violating the unique classId + memberId index.
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
  existingRegistration.registeredAt = new Date();

  await existingRegistration.save();

  return res.status(200).json({
    success: true,
    message:
      "Cancelled registration reactivated. Payment is required to confirm the registration.",
    data: {
      id: existingRegistration._id,
      classId: existingRegistration.classId,
      memberId: existingRegistration.memberId,
      status: existingRegistration.status,
      registeredAt: existingRegistration.registeredAt,
      createdAt: existingRegistration.createdAt,
      updatedAt: existingRegistration.updatedAt,
    },
  });
}

// Create a new registration.
const registration = await ClassRegistration.create({
  classId,
  memberId: targetMember._id,
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

// GET all class registrations
const getClassRegistrations = async (req, res) => {
  try {
    const registrations = await ClassRegistration.find()
      .populate("memberId", "fullName phone goal level")
      .populate("classId", "name subjectId courseId coachId")
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

// UPDATE class registration
const updateClassRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const { classId, memberId, status } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid class registration ID",
      });
    }

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

    const isMember = req.user.role === "MEMBER";

    // Members may only update their own registration and may cancel it.
    if (isMember) {
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
        registration.memberId.toString() !== ownMember._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You cannot update another member's registration",
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
        (classId &&
          (!isValidId(classId) ||
            classId.toString() !== registration.classId.toString())) ||
        (memberId &&
          (!isValidId(memberId) ||
            memberId.toString() !== registration.memberId.toString()))
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Members cannot change the class or member of a registration",
        });
      }
    }

    // Resolve the values that will be saved.
    const newClassId = classId || registration.classId;
    const newMemberId = memberId || registration.memberId;

    if (!isValidId(newClassId) || !isValidId(newMemberId)) {
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

    // Keep a payment tied to the original registration details.
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

    const duplicateRegistration = await ClassRegistration.findOne({
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

    // Do not cancel a paid registration before refund handling exists.
if (newStatus === "CANCELLED") {
  const successfulPayment = await Payment.exists({
    classRegistrationId: registration._id,
    status: "SUCCESS",
  });

  if (successfulPayment) {
    return res.status(409).json({
      success: false,
      message:
        "Cannot cancel a paid registration until the refund process is handled",
    });
  }
}
    
    // Check capacity before activating a registration.
if (
  ["PENDING_PAYMENT", "CONFIRMED"].includes(newStatus)
) {
  const capacity = await checkClassCapacity(
    classData,
    registration._id
  );

  if (!capacity.available) {
    return res.status(409).json({
      success: false,
      message: capacity.message,
    });
  }
}
    
    // A staff member cannot confirm a registration without a successful payment.
    // Members are already blocked from setting CONFIRMED above.
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
