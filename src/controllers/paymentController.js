const Payment = require("../models/Payment");
const ClassRegistration = require("../models/ClassRegistration");
const Member = require("../models/Member");


// CREATE payment

const createPayment = async (req, res) => {
  try {
    const {
      classRegistrationId,
      amount,
      paymentMethod,
    } = req.body;

    if (
      !classRegistrationId ||
      amount === undefined ||
      !paymentMethod
    ) {
      return res.status(400).json({
        success: false,
        message:
          "classRegistrationId, amount and paymentMethod are required",
      });
    }

    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "amount must be a valid number >= 0",
      });
    }

    const classRegistration =
      await ClassRegistration.findById(classRegistrationId);

    if (!classRegistration) {
      return res.status(404).json({
        success: false,
        message: "Class registration not found",
      });
    }

    if (classRegistration.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot make payment for a cancelled registration",
      });
    }

    if (classRegistration.status === "CONFIRMED") {
      return res.status(400).json({
        success: false,
        message:
          "This class registration is already confirmed",
      });
    }

    const validPaymentMethods = [
      "CASH",
      "BANK_TRANSFER",
      "ONLINE",
    ];

    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message:
          "paymentMethod must be CASH, BANK_TRANSFER or ONLINE",
      });
    }

    // Never trust payment status or payment date sent by the client.
    const payment = await Payment.create({
      classRegistrationId,
      amount,
      paymentMethod,
      status: "PENDING",
      paymentDate: null,
    });

    return res.status(201).json({
      success: true,
      message: "Payment created successfully",
      data: {
        id: payment._id,
        classRegistrationId: payment.classRegistrationId,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        paymentDate: payment.paymentDate,
        registrationStatus: classRegistration.status,
        createdAt: payment.createdAt,
      },
    });
  } catch (error) {
    console.error("Create payment error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET all payments
const getPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate({
        path: "classRegistrationId",
        populate: [
          {
            path: "memberId",
            select: "fullName phone goal level",
          },
          {
            path: "classId",
            select: "name subjectId courseId coachId",
          },
        ],
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Payments retrieved successfully",
      data: payments,
    });
  } catch (error) {
    console.error("Get payments error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// UPDATE payment

const updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      classRegistrationId,
      amount,
      paymentMethod,
      status,
      paymentDate,
    } = req.body;

    const payment = await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Payment status must only be changed by the mock simulation endpoint.
    if (status !== undefined || paymentDate !== undefined) {
      return res.status(400).json({
        success: false,
        message:
          "Payment status and paymentDate cannot be changed through this endpoint",
      });
    }

    // Do not allow changing the registration associated with a payment.
    if (
      classRegistrationId !== undefined &&
      classRegistrationId.toString() !==
        payment.classRegistrationId.toString()
    ) {
      return res.status(400).json({
        success: false,
        message: "Cannot change classRegistrationId",
      });
    }

    const classRegistration =
      await ClassRegistration.findById(
        payment.classRegistrationId
      );

    if (!classRegistration) {
      return res.status(404).json({
        success: false,
        message: "Class registration not found",
      });
    }

    if (classRegistration.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot update payment for a cancelled registration",
      });
    }

    if (payment.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Only pending payments can be updated",
      });
    }

    if (
      amount !== undefined &&
      (
        typeof amount !== "number" ||
        !Number.isFinite(amount) ||
        amount < 0
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "amount must be a valid number >= 0",
      });
    }

    const validPaymentMethods = [
      "CASH",
      "BANK_TRANSFER",
      "ONLINE",
    ];

    if (
      paymentMethod !== undefined &&
      !validPaymentMethods.includes(paymentMethod)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "paymentMethod must be CASH, BANK_TRANSFER or ONLINE",
      });
    }

    if (amount !== undefined) {
      payment.amount = amount;
    }

    if (paymentMethod !== undefined) {
      payment.paymentMethod = paymentMethod;
    }

    await payment.save();

    return res.status(200).json({
      success: true,
      message: "Payment updated successfully",
      data: {
        id: payment._id,
        classRegistrationId: payment.classRegistrationId,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        paymentDate: payment.paymentDate,
        registrationStatus: classRegistration.status,
        updatedAt: payment.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update payment error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};





const simulatePaymentResult = async (req, res) => {
  try {
    if (process.env.PAYMENT_MODE !== "mock") {
      return res.status(403).json({
        success: false,
        message: "Mock payment mode is disabled",
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!["SUCCESS", "FAILED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status must be SUCCESS or FAILED",
      });
    }

    // Find the logged-in member's profile
    const member = await Member.findOne({
      userId: req.user.userId,
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member profile not found",
      });
    }

    const payment = await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (payment.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Only pending payments can be simulated",
      });
    }

    const registration = await ClassRegistration.findById(
      payment.classRegistrationId
    );

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Class registration not found",
      });
    }

    // A member can only simulate their own registration
    if (registration.memberId.toString() !== member._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You cannot access this payment",
      });
    }

    if (registration.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Cannot pay for a cancelled registration",
      });
    }

    payment.status = status;

    if (status === "SUCCESS") {
      payment.paymentDate = new Date();
      registration.status = "CONFIRMED";
    }

    await payment.save();
    await registration.save();

    return res.status(200).json({
      success: true,
      message: `Mock payment ${status.toLowerCase()}`,
      data: {
        paymentId: payment._id,
        paymentStatus: payment.status,
        registrationStatus: registration.status,
      },
    });
  } catch (error) {
    console.error("Simulate payment error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


module.exports = {
  createPayment,
  getPayments,
  updatePayment,
  simulatePaymentResult,
};