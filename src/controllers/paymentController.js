const Payment = require("../models/Payment");
const ClassRegistration = require("../models/ClassRegistration");
const Member = require("../models/Member");
const { VNPay, ProductCode, VnpLocale } = require("vnpay");
const mongoose = require("mongoose");
const { payosClient, reconcilePayosPayment } = require("../services/payosService");

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
// MEMBER can only create payment for their own registration.
if (req.user.role === "MEMBER") {
  const member = await Member.findOne({
    userId: req.user.userId,
  });

  if (!member) {
    return res.status(404).json({
      success: false,
      message: "Member profile not found",
    });
  }

  if (classRegistration.memberId.toString() !== member._id.toString()) {
    return res.status(403).json({
      success: false,
      message: "You cannot create payment for another member's registration",
    });
  }
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
// Prevent duplicate pending or successful payments.
const existingPayment = await Payment.findOne({
  classRegistrationId: classRegistration._id,
  status: { $in: ["PENDING", "SUCCESS"] },
});

if (existingPayment) {
  return res.status(409).json({
    success: false,
    message: "A pending or successful payment already exists for this registration",
    data: {
      paymentId: existingPayment._id,
      status: existingPayment.status,
    },
  });
}
    // Use the price saved when the member registered for the class.
    const amount = classRegistration.priceSnapshot;

    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Registration priceSnapshot must be greater than 0",
      });
    }

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


// GET payments visible to the signed-in user
const getPayments = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === "MEMBER") {
      const member = await Member.findOne({ userId: req.user.userId }).select("_id");
      const registrationIds = member
        ? await ClassRegistration.distinct("_id", { memberId: member._id })
        : [];
      filter.classRegistrationId = { $in: registrationIds };
    }

    const payments = await Payment.find(filter)
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

// UPDATE payment
const updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      classRegistrationId,
      paymentMethod,
      status,
      paymentDate,
    } = req.body;

    // Payment amount must never be changed through this endpoint.
    if (req.body.amount !== undefined) {
      return res.status(400).json({
        success: false,
        message:
          "Payment amount cannot be changed. It is determined by ClassRegistration.priceSnapshot.",
      });
    }

    const payment = await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Only the payment simulation or VNPay callback can change payment status.
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

    const classRegistration = await ClassRegistration.findById(
      payment.classRegistrationId
    );

    if (!classRegistration) {
      return res.status(404).json({
        success: false,
        message: "Class registration not found",
      });
    }
// MEMBER can only update their own payment.
if (req.user.role === "MEMBER") {
  const member = await Member.findOne({
    userId: req.user.userId,
  });

  if (!member) {
    return res.status(404).json({
      success: false,
      message: "Member profile not found",
    });
  }

  if (classRegistration.memberId.toString() !== member._id.toString()) {
    return res.status(403).json({
      success: false,
      message: "You cannot update another member's payment",
    });
  }
}
    if (classRegistration.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Cannot update payment for a cancelled registration",
      });
    }

    if (payment.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Only pending payments can be updated",
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

    if (paymentMethod !== undefined && paymentMethod !== payment.paymentMethod) {
      const updated = await Payment.findOneAndUpdate(
        { _id: payment._id, status: "PENDING", payosOrderCode: { $exists: false } },
        { $set: { paymentMethod } },
        { returnDocument: "after" }
      );
      if (!updated) {
        return res.status(409).json({
          success: false,
          message: "Không thể đổi phương thức khi đã tạo yêu cầu payOS hoặc giao dịch đã được xử lý.",
        });
      }
      payment.paymentMethod = updated.paymentMethod;
      payment.updatedAt = updated.updatedAt;
    }

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
// Only ONLINE payments can be simulated.
if (payment.paymentMethod !== "ONLINE") {
  return res.status(400).json({
    success: false,
    message: "Only ONLINE payments can be simulated",
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
    if (["mock", "payos"].includes(process.env.PAYMENT_MODE)) {
      return res.status(403).json({
        success: false,
        message: "VNPay is disabled in the current payment mode",
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

    const payment = await Payment.findOne({ _id: result.vnp_TxnRef, payosOrderCode: { $exists: false } });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // VNPay returns vnp_Amount multiplied by 100.
const expectedVnpayAmount = Number(payment.amount) * 100;

if (Number(result.vnp_Amount) !== expectedVnpayAmount) {
  return res.status(400).json({
    success: false,
    message: "Payment amount does not match",
  });
}

// Prevent duplicate callbacks from changing payment status.
if (payment.status === "SUCCESS") {
  return res.status(200).json({
    success: true,
    message: "Payment was already confirmed",
    data: {
      paymentId: payment._id,
      status: payment.status,
    },
  });
}

// Do not allow a FAILED payment to become SUCCESS through a late callback.
if (payment.status === "FAILED") {
  return res.status(200).json({
    success: false,
    message: "Payment was already marked as FAILED",
    data: {
      paymentId: payment._id,
      status: payment.status,
    },
  });
}

// Find related registration.
const registration = await ClassRegistration.findById(
  payment.classRegistrationId
);

if (!registration) {
  return res.status(404).json({
    success: false,
    message: "Class registration not found",
  });
}

if (result.isSuccess) {
  payment.status = "SUCCESS";
  payment.paymentDate = new Date();
  await payment.save();

  // Only confirm registrations that are still awaiting payment.
  if (registration.status === "PENDING_PAYMENT") {
    registration.status = "CONFIRMED";
    await registration.save();
  }
} else {
  payment.status = "FAILED";
  await payment.save();
}

return res.status(200).json({
  success: result.isSuccess,
  message:
    result.isSuccess && registration.status === "CANCELLED"
      ? "Payment succeeded, but registration is cancelled. Manual refund handling is required."
      : result.message,
  data: {
    paymentId: payment._id,
    status: payment.status,
    registrationStatus: registration.status,
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

    // Verify VNPay signature.
    if (!result.isVerified) {
      return res.status(200).json({
        RspCode: "97",
        Message: "Invalid signature",
      });
    }

    // Find payment using VNPay transaction reference.
    const payment = await Payment.findOne({ _id: result.vnp_TxnRef, payosOrderCode: { $exists: false } });

    if (!payment) {
      return res.status(200).json({
        RspCode: "01",
        Message: "Order not found",
      });
    }

    // Only ONLINE payments can be processed by VNPay.
    if (payment.paymentMethod !== "ONLINE") {
      return res.status(200).json({
        RspCode: "04",
        Message: "Invalid payment method",
      });
    }

    // Verify the amount returned by VNPay.
    // VNPay sends the amount multiplied by 100.
    const expectedVnpayAmount = Number(payment.amount) * 100;

    if (Number(result.vnp_Amount) !== expectedVnpayAmount) {
      return res.status(200).json({
        RspCode: "04",
        Message: "Invalid amount",
      });
    }

    // Prevent duplicate callbacks from changing a successful payment.
    if (payment.status === "SUCCESS") {
      return res.status(200).json({
        RspCode: "02",
        Message: "Order already confirmed",
      });
    }

    // Do not allow a FAILED payment to become SUCCESS
    // through a late callback.
    if (payment.status === "FAILED") {
      return res.status(200).json({
        RspCode: "00",
        Message: "Payment was already processed",
      });
    }

    // Find the related class registration.
    const registration = await ClassRegistration.findById(
      payment.classRegistrationId
    );

    if (!registration) {
      return res.status(200).json({
        RspCode: "01",
        Message: "Class registration not found",
      });
    }

    if (result.isSuccess) {
      payment.status = "SUCCESS";
      payment.paymentDate = new Date();

      await payment.save();

      // Only confirm registrations that are still awaiting payment.
      if (registration.status === "PENDING_PAYMENT") {
        registration.status = "CONFIRMED";
        await registration.save();
      }
    } else {
      payment.status = "FAILED";
      await payment.save();
    }

    return res.status(200).json({
      RspCode: "00",
      Message:
        result.isSuccess && registration.status === "CANCELLED"
          ? "Payment successful, but registration is cancelled. Manual refund handling is required."
          : "Confirm Success",
    });
  } catch (error) {
    console.error("VNPay IPN error:", error);

    return res.status(200).json({
      RspCode: "99",
      Message: "Unknown error",
    });
  }
};

// RECORD OFFLINE PAYMENT AT FRONT DESK
const recordOfflinePayment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID",
      });
    }

    const payment = await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (!["CASH", "BANK_TRANSFER"].includes(payment.paymentMethod)) {
      return res.status(400).json({
        success: false,
        message:
          "Only CASH or BANK_TRANSFER payments can be recorded at the front desk",
      });
    }

    if (payment.status !== "PENDING") {
      return res.status(409).json({
        success: false,
        message: "Only pending payments can be recorded",
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

    if (registration.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Cannot record payment for a cancelled registration",
      });
    }

    if (registration.status === "CONFIRMED") {
      return res.status(409).json({
        success: false,
        message: "Registration is already confirmed",
      });
    }

    payment.status = "SUCCESS";
    payment.paymentDate = new Date();
    await payment.save();

    registration.status = "CONFIRMED";
    await registration.save();

    return res.status(200).json({
      success: true,
      message: "Payment recorded successfully",
      data: {
        paymentId: payment._id,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        paymentDate: payment.paymentDate,
        registrationId: registration._id,
        registrationStatus: registration.status,
      },
    });
  } catch (error) {
    console.error("Record offline payment error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET PRINTABLE PAYMENT RECEIPT
const getPaymentReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID",
      });
    }

    const payment = await Payment.findById(id).populate({
      path: "classRegistrationId",
      populate: [
        {
          path: "memberId",
          select: "fullName phone userId",
        },
        {
          path: "classId",
          select: "name courseId",
          populate: {
            path: "courseId",
            select: "name",
          },
        },
      ],
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Only successful payments can produce a paid receipt.
    if (payment.status !== "SUCCESS") {
      return res.status(409).json({
        success: false,
        message: "A receipt is available only for successful payments",
      });
    }

    const registration = payment.classRegistrationId;

    if (!registration || !registration.memberId || !registration.classId) {
      return res.status(404).json({
        success: false,
        message: "Related registration data was not found",
      });
    }

    // Members can only print their own receipt.
    if (req.user.role === "MEMBER") {
      const currentMember = await Member.findOne({
        userId: req.user.userId,
      });

      if (
        !currentMember ||
        currentMember._id.toString() !== registration.memberId._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You cannot access this receipt",
        });
      }
    }

    // Escape database values before inserting them into HTML.
    const escapeHtml = (value) =>
      String(value ?? "").replace(/[&<>"']/g, (character) => {
        const entities = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        };

        return entities[character];
      });

    const member = registration.memberId;
    const classInfo = registration.classId;
    const course = classInfo.courseId;

    const receiptNumber = payment._id.toString();
    const paidAt = payment.paymentDate
      ? new Date(payment.paymentDate).toLocaleString("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
        })
      : "N/A";

    const amount = `${Number(payment.amount).toLocaleString("vi-VN")} ₫`;

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Biên nhận thanh toán - ${escapeHtml(receiptNumber)}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 760px;
      margin: 40px auto;
      padding: 24px;
      color: #222;
    }
    h1, .center { text-align: center; }
    .subtitle { color: #555; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    td { padding: 12px 8px; border-bottom: 1px solid #ddd; }
    td:first-child { color: #555; width: 40%; }
    .amount { font-size: 22px; font-weight: bold; }
    .status { color: #187547; font-weight: bold; }
    button {
      display: block;
      margin: 28px auto;
      padding: 10px 22px;
      cursor: pointer;
    }
    @media print {
      body { margin: 0 auto; padding: 8px; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <h1>SPORT CENTER</h1>
  <p class="subtitle">BIÊN NHẬN THANH TOÁN</p>

  <table>
    <tr><td>Mã biên nhận</td><td>${escapeHtml(receiptNumber)}</td></tr>
    <tr><td>Hội viên</td><td>${escapeHtml(member.fullName)}</td></tr>
    <tr><td>Số điện thoại</td><td>${escapeHtml(member.phone)}</td></tr>
    <tr><td>Lớp</td><td>${escapeHtml(classInfo.name)}</td></tr>
    <tr><td>Khóa học</td><td>${escapeHtml(course?.name || "N/A")}</td></tr>
    <tr><td>Phương thức</td><td>${escapeHtml(payment.paymentMethod)}</td></tr>
    <tr><td>Thời gian thanh toán</td><td>${escapeHtml(paidAt)}</td></tr>
    <tr><td>Trạng thái</td><td class="status">ĐÃ THANH TOÁN</td></tr>
    <tr><td><strong>Tổng tiền</strong></td><td class="amount">${escapeHtml(amount)}</td></tr>
  </table>

  <p class="center">Cảm ơn quý hội viên đã sử dụng dịch vụ!</p>
  <button onclick="window.print()">In / Lưu thành PDF</button>
</body>
</html>`;

    return res.status(200).type("html").send(html);
  } catch (error) {
    console.error("Get payment receipt error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
// GET payment status by ID
const getPaymentStatusById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate payment ID
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID",
      });
    }

    // Find payment
    let payment = await Payment.findById(id).select(
      "_id classRegistrationId status paymentDate amount payosOrderCode"
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Find related class registration
    let registration = await ClassRegistration.findById(
      payment.classRegistrationId
    ).select("memberId status");

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Class registration not found",
      });
    }

    // MEMBER can only check their own payment
    if (req.user.role === "MEMBER") {
      const member = await Member.findOne({
        userId: req.user.userId,
      }).select("_id");

      if (!member) {
        return res.status(404).json({
          success: false,
          message: "Member profile not found",
        });
      }

      if (
        registration.memberId.toString() !== member._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You cannot access this payment",
        });
      }
    }

    if (payment.status === "PENDING" && payment.payosOrderCode) {
      const client = payosClient();
      if (!client) return res.status(503).json({ success: false, message: "BE chưa có đủ khóa cấu hình payOS." });
      try {
        await reconcilePayosPayment(client, payment);
      } catch (error) {
        console.error("payOS status check failed:", error.name);
        return res.status(502).json({ success: false, message: "Chưa kiểm tra được giao dịch payOS. Vui lòng thử lại." });
      }
      [payment, registration] = await Promise.all([
        Payment.findById(id).select("status paymentDate"),
        ClassRegistration.findById(registration._id).select("status"),
      ]);
    }

    return res.status(200).json({
      success: true,
      message: "Payment status retrieved successfully",
      data: {
        paymentId: payment._id,
        status: payment.status,
        paymentDate: payment.paymentDate,
        registrationStatus: registration.status,
      },
    });
  } catch (error) {
    console.error("Get payment status error:", error);

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
  createVnpayPaymentUrl,
  vnpayReturn,
  vnpayIpn,
  recordOfflinePayment,
  getPaymentReceipt,
  getPaymentStatusById,
};
