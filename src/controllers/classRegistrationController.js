
const mongoose = require("mongoose");

const ClassRegistration = require("../models/ClassRegistration");
const Class = require("../models/Class");
const Course = require("../models/Course");
const Member = require("../models/Member");
const Notification = require("../models/Notification");
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
  if (course.status !== "ACTIVE") return { success: false, statusCode: 409, message: "Course is not accepting registrations" };
  const price = Course.tuitionOf(course);
  if (price === undefined) {
    return { success: false, statusCode: 400, message: "Course tuition has not been configured" };
  }
  return { success: true, price };
};

const checkClassCapacity = async (
  classData,
  excludeRegistrationId = null,
    session = null
) => {
  if ((classData.classType || "GROUP") !== "PERSONAL") {
    return { available: true };
  }

  const filter = {
    classId: classData._id,
    status: { $in: ["PENDING_PAYMENT", "CONFIRMED"] },
  };

  if (excludeRegistrationId) {
    filter._id = { $ne: excludeRegistrationId };
  }

  const activeRegistration =
    await ClassRegistration.findOne(filter).session(session);

  if (activeRegistration) {
    return {
      available: false,
      message:
        "This personal class already has a pending or confirmed member",
    };
  }

  return { available: true };
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

    if (existingRegistration?.status === "PENDING_PAYMENT" && existingRegistration.priceSnapshot === 0) {
      const registration = await ClassRegistration.findOneAndUpdate(
        { _id: existingRegistration._id, status: "PENDING_PAYMENT", priceSnapshot: 0 },
        { $set: { status: "CONFIRMED" } },
        { returnDocument: "after" }
      );
      if (registration) {
        return res.json({ success: true, message: "Registration confirmed.", data: registration });
      }
    }

    if (
      existingRegistration &&
      existingRegistration.status !== "CANCELLED"
    ) {
      return res.status(409).json({
        success: false,
        message: "Member is already registered for this class",
      });
    }

    const capacity = await checkClassCapacity(classData, existingRegistration?._id);
    if (!capacity.available) return res.status(409).json({ success: false, message: capacity.message });

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

      existingRegistration.status = priceResult.price === 0 ? "CONFIRMED" : "PENDING_PAYMENT";
      existingRegistration.priceSnapshot = priceResult.price;
      existingRegistration.registeredAt = new Date();

      await existingRegistration.save();

      return res.status(200).json({
        success: true,
        message:
          priceResult.price === 0 ? "Registration confirmed." : "Cancelled registration reactivated. Payment is required to confirm the registration.",
        data: existingRegistration,
      });
    }

    // Create new registration with price snapshot
    const registration = await ClassRegistration.create({
      classId,
      memberId: targetMember._id,
      status: priceResult.price === 0 ? "CONFIRMED" : "PENDING_PAYMENT",
      priceSnapshot: priceResult.price,
      registeredAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message:
        priceResult.price === 0 ? "Registration confirmed." : "Class registration created. Payment is required to confirm the registration.",
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
      if (!member) return res.json({ success: true, data: [] });
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
        await Payment.exists({ classRegistrationId: registration._id, status: "PENDING", paymentMethod: "ONLINE" })) {
      return res.status(409).json({
        success: false,
        message: "Hãy hủy yêu cầu trên trang payOS hoặc đợi link hết hạn, rồi kiểm tra trạng thái thanh toán trước khi hủy đăng ký.",
      });
    }

    // Staff cannot confirm without a successful payment.
    if (["PENDING_PAYMENT", "CONFIRMED"].includes(newStatus)) {
      const capacity = await checkClassCapacity(classData, registration._id);
      if (!capacity.available) return res.status(409).json({ success: false, message: capacity.message });
    }

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

// POST /api/class-registrations/:id/confirm  body: { paymentMethod: "CASH" | "BANK_TRANSFER" }
// Front desk approval: the receptionist collects the fee at the desk and confirms the registration,
// which turns on the member's QR entry pass. Recording the payment and confirming happen together;
// a second click (or a second receptionist) gets the same result instead of a second payment.
const confirmRegistration = async (req, res) => {
  const { id } = req.params;
  const paymentMethod = req.body?.paymentMethod || "CASH";

  if (!isValidId(id)) {
    return res.status(400).json({ success: false, message: "Invalid class registration ID" });
  }
  if (!["CASH", "BANK_TRANSFER"].includes(paymentMethod)) {
    return res.status(400).json({ success: false, message: "paymentMethod must be CASH or BANK_TRANSFER" });
  }

  const fail = (status, message) => Object.assign(new Error(message), { status });

  try {
    const result = await mongoose.connection.transaction(async (session) => {
      const registration = await ClassRegistration.findById(id).session(session);
      if (!registration) throw fail(404, "Không tìm thấy đăng ký.");
      if (registration.status === "CANCELLED") throw fail(409, "Đăng ký đã hủy, không thể xác nhận.");
      if (registration.status === "CONFIRMED") return { registration, payment: null, alreadyConfirmed: true };

      if (await Payment.exists({ classRegistrationId: registration._id, status: "PENDING", payosOrderCode: { $exists: true } }).session(session)) {
        throw fail(409, "Hội viên đang có yêu cầu thanh toán trực tuyến chưa xong. Kiểm tra trạng thái thanh toán trước khi thu tiền tại quầy.");
      }

      const classData = await Class.findById(registration.classId).session(session);
      if (!classData) throw fail(404, "Không tìm thấy lớp học của đăng ký.");
      const capacity = await checkClassCapacity(classData, registration._id, session);
      if (!capacity.available) throw fail(409, capacity.message);

      const now = new Date();
      // Only one confirmation can move the registration out of PENDING_PAYMENT.
      const confirmed = await ClassRegistration.findOneAndUpdate(
        { _id: registration._id, status: "PENDING_PAYMENT" },
        { $set: { status: "CONFIRMED", confirmedBy: req.user.userId, confirmedAt: now } },
        { session, returnDocument: "after" }
      );
      if (!confirmed) return { registration, payment: null, alreadyConfirmed: true };

      const payment = await Payment.findOneAndUpdate(
        { classRegistrationId: registration._id, status: "PENDING", paymentMethod: { $in: ["CASH", "BANK_TRANSFER"] } },
        { $set: { status: "SUCCESS", paymentMethod, paymentDate: now } },
        { session, returnDocument: "after" }
      ) || (await Payment.create([{
        classRegistrationId: registration._id,
        amount: registration.priceSnapshot,
        paymentMethod,
        status: "SUCCESS",
        paymentDate: now,
      }], { session }))[0];

      return { registration: confirmed, payment, alreadyConfirmed: false, className: classData.name };
    });

    if (!result.alreadyConfirmed) {
      try {
        const member = await Member.findById(result.registration.memberId).select("userId").lean();
        if (member?.userId) {
          await Notification.create({
            userId: member.userId,
            title: "Đăng ký lớp đã được xác nhận",
            message: `Lễ tân đã xác nhận đăng ký lớp ${result.className || ""}. Mã QR ra/vào trung tâm đã sẵn sàng trong ứng dụng.`.replace("  ", " "),
          });
        }
      } catch (error) {
        console.error("Registration confirmed notification error:", error.message);
      }
    }

    return res.status(result.alreadyConfirmed ? 200 : 201).json({
      success: true,
      message: result.alreadyConfirmed ? "Đăng ký đã được xác nhận trước đó." : "Đã thu tiền và xác nhận đăng ký.",
      data: {
        registrationId: result.registration._id,
        status: "CONFIRMED",
        alreadyConfirmed: result.alreadyConfirmed,
        confirmedAt: result.registration.confirmedAt || null,
        payment: result.payment
          ? { id: result.payment._id, amount: result.payment.amount, paymentMethod: result.payment.paymentMethod, status: result.payment.status }
          : null,
      },
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error("Confirm class registration error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  registerClass,
  getClassRegistrations,
  updateClassRegistration,
  checkClassCapacity,
  confirmRegistration,
};
