const Payment = require("../models/Payment");
const ClassRegistration = require("../models/ClassRegistration");
const Member = require("../models/Member");
const { VNPay, ProductCode, VnpLocale } = require("vnpay");
const Class = require("../models/Class");
const Course = require("../models/Course");

const vnpay = new VNPay({
  tmnCode: process.env.VNPAY_TMN_CODE,
  secureSecret: process.env.VNPAY_HASH_SECRET,
  vnpayHost: "https://sandbox.vnpayment.vn",
  testMode: true,
  hashAlgorithm: "SHA512",
});

// CREATE payment


const createPayment = async (req, res) => {
  try {
    const { classRegistrationId, paymentMethod } = req.body;

    if (!classRegistrationId || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "classRegistrationId and paymentMethod are required",
      });
    }

    const classRegistration = await ClassRegistration.findById(
      classRegistrationId
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
        message: "Cannot make payment for a cancelled registration",
      });
    }

    if (classRegistration.status === "CONFIRMED") {
      return res.status(400).json({
        success: false,
        message: "This class registration is already confirmed",
      });
    }

    const validPaymentMethods = ["CASH", "BANK_TRANSFER", "ONLINE"];

    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "paymentMethod must be CASH, BANK_TRANSFER or ONLINE",
      });
    }

    // Get the class from the registration.
    const classInfo = await Class.findById(classRegistration.classId);

    if (!classInfo) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Get the actual course price from the database.
    const course = await Course.findById(classInfo.courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (
      typeof course.price !== "number" ||
      !Number.isFinite(course.price) ||
      course.price <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Course price must be greater than 0",
      });
    }

    // Never use an amount sent by the frontend.
    const amount = course.price;

    const payment = await Payment.create({
      classRegistrationId: classRegistration._id,
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

const createVnpayPaymentUrl = async (req, res) => {
  try {
    if (process.env.PAYMENT_MODE === "mock") {
      return res.status(403).json({
        success: false,
        message: "VNPay is disabled while PAYMENT_MODE=mock",
      });
    }

    if (
      !process.env.VNPAY_TMN_CODE ||
      !process.env.VNPAY_HASH_SECRET ||
      !process.env.VNPAY_RETURN_URL
    ) {
      return res.status(500).json({
        success: false,
        message: "VNPay environment variables are not configured",
      });
    }

    const { id } = req.params;

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
        message: "Only pending payments can be paid",
      });
    }

    if (payment.paymentMethod !== "ONLINE") {
      return res.status(400).json({
        success: false,
        message: "Only ONLINE payments can use VNPay",
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

    if (registration.memberId.toString() !== member._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You cannot access this payment",
      });
    }

    if (registration.status !== "PENDING_PAYMENT") {
      return res.status(400).json({
        success: false,
        message: "Registration is not awaiting payment",
      });
    }

    const vnpay = new VNPay({
      tmnCode: process.env.VNPAY_TMN_CODE,
      secureSecret: process.env.VNPAY_HASH_SECRET,
      vnpayHost: "https://sandbox.vnpayment.vn",
      testMode: true,
      hashAlgorithm: "SHA512",
    });

    const paymentUrl = vnpay.buildPaymentUrl({
      vnp_Amount: payment.amount,
      vnp_IpAddr:
        req.ip?.replace(/^::ffff:/, "") || "127.0.0.1",
      vnp_TxnRef: payment._id.toString(),
      vnp_OrderInfo: `Payment ${payment._id}`,
      vnp_OrderType: ProductCode.Other,
      vnp_ReturnUrl: process.env.VNPAY_RETURN_URL,
      vnp_Locale: VnpLocale.VN,
    });

    return res.status(200).json({
      success: true,
      message: "VNPay payment URL created",
      data: {
        paymentId: payment._id,
        amount: payment.amount,
        paymentUrl,
      },
    });
  } catch (error) {
    console.error("Create VNPay URL error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not create VNPay payment URL",
    });
  }
};

// VNPay browser return URL
const vnpayReturn = async (req, res) => {
  try {
    const result = vnpay.verifyReturnUrl(req.query);

    if (!result.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Invalid VNPay signature",
      });
    }

    const payment = await Payment.findById(result.vnp_TxnRef);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Prevent a failed/duplicate callback from changing a successful payment.
    if (payment.status === "SUCCESS") {
      return res.status(200).json({
        success: true,
        message: "Payment was already confirmed",
        data: { paymentId: payment._id, status: payment.status },
      });
    }

    // VNPay sends vnp_Amount in units multiplied by 100.
    if (Number(result.vnp_Amount) !== payment.amount * 100) {
      return res.status(400).json({
        success: false,
        message: "Payment amount does not match",
      });
    }

    if (result.isSuccess) {
      payment.status = "SUCCESS";
      payment.paymentDate = new Date();
      await payment.save();

      await ClassRegistration.findByIdAndUpdate(
        payment.classRegistrationId,
        { status: "CONFIRMED" }
      );
    } else {
      payment.status = "FAILED";
      await payment.save();
    }

    return res.status(200).json({
      success: result.isSuccess,
      message: result.message,
      data: {
        paymentId: payment._id,
        status: payment.status,
      },
    });
  } catch (error) {
    console.error("VNPay return error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not process VNPay return",
    });
  }
};

// VNPay server-to-server IPN callback
const vnpayIpn = async (req, res) => {
  try {
    const result = vnpay.verifyIpnCall(req.query);

    if (!result.isVerified) {
      return res.status(200).json({
        RspCode: "97",
        Message: "Invalid signature",
      });
    }

    const payment = await Payment.findById(result.vnp_TxnRef);

    if (!payment) {
      return res.status(200).json({
        RspCode: "01",
        Message: "Order not found",
      });
    }

    if (Number(result.vnp_Amount) !== payment.amount * 100) {
      return res.status(200).json({
        RspCode: "04",
        Message: "Invalid amount",
      });
    }

    if (payment.status === "SUCCESS") {
      return res.status(200).json({
        RspCode: "02",
        Message: "Order already confirmed",
      });
    }

    if (result.isSuccess) {
      payment.status = "SUCCESS";
      payment.paymentDate = new Date();
      await payment.save();

      await ClassRegistration.findByIdAndUpdate(
        payment.classRegistrationId,
        { status: "CONFIRMED" }
      );
    } else {
      payment.status = "FAILED";
      await payment.save();
    }

    return res.status(200).json({
      RspCode: "00",
      Message: "Confirm Success",
    });
  } catch (error) {
    console.error("VNPay IPN error:", error);
    return res.status(200).json({
      RspCode: "99",
      Message: "Unknown error",
    });
  }
};

module.exports = {
  createPayment,
  getPayments,
  updatePayment,
  simulatePaymentResult,
  createVnpayPaymentUrl,
  vnpayReturn,
  vnpayIpn,
};