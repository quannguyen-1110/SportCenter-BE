const Payment = require("../models/Payment");
const ClassRegistration = require("../models/ClassRegistration");

const createPayment = async (req, res) => {
  try {
    const {
      classRegistrationId,
      amount,
      paymentMethod,
      status,
      paymentDate,
    } = req.body;

    // Validate required fields
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

    // Validate amount
    if (amount < 0) {
      return res.status(400).json({
        success: false,
        message: "amount must be >= 0",
      });
    }

    // Check class registration
    const classRegistration =
      await ClassRegistration.findById(classRegistrationId);

    if (!classRegistration) {
      return res.status(404).json({
        success: false,
        message: "Class registration not found",
      });
    }

    // Check cancelled registration
    if (classRegistration.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Cannot make payment for a cancelled registration",
      });
    }

    // Validate payment method
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

    // Validate payment status
    const validStatuses = [
      "PENDING",
      "SUCCESS",
      "FAILED",
    ];

    const paymentStatus = status || "PENDING";

    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message:
          "status must be PENDING, SUCCESS or FAILED",
      });
    }

    // Validate payment date
    let paymentDateValue = null;

    if (paymentDate) {
      paymentDateValue = new Date(paymentDate);

      if (Number.isNaN(paymentDateValue.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid paymentDate",
        });
      }
    }

    // Create payment
    const payment = await Payment.create({
      classRegistrationId,
      amount,
      paymentMethod,
      status: paymentStatus,
      paymentDate: paymentDateValue,
    });

    // If payment is successful, confirm class registration
    if (paymentStatus === "SUCCESS") {
      classRegistration.status = "CONFIRMED";
      await classRegistration.save();
    }

    return res.status(201).json({
      success: true,
      message:
        paymentStatus === "SUCCESS"
          ? "Payment successful and class registration confirmed"
          : "Payment created successfully",
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

module.exports = {
  createPayment,
};