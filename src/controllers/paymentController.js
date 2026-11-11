const Payment = require("../models/Payment");
const ClassRegistration = require("../models/ClassRegistration");
const Member = require("../models/Member");
const { ProductCode, VnpLocale } = require("vnpay");
const { getVnpay, vnpayDate, paymentError, verifyVnpayResponse, applyVnpayResponse } = require("../services/vnpayService");
const mongoose = require("mongoose");
const { payosClient, reconcilePayosPayment } = require("../services/payosService");


// CREATE payment
const createPaymentForProvider = async (req, res, provider) => {
  try {
    const { classRegistrationId, paymentMethod } = req.body || {};
    if (!mongoose.isValidObjectId(classRegistrationId) || !["CASH", "BANK_TRANSFER", "ONLINE"].includes(paymentMethod)) {
      throw paymentError(400, "Valid classRegistrationId and paymentMethod are required");
    }
    if (provider === "PAYOS" && paymentMethod !== "ONLINE") {
      throw paymentError(400, "Mobile payOS payments must use ONLINE");
    }
    const result = await mongoose.connection.transaction(async session => {
      const registration = await ClassRegistration.findById(classRegistrationId).session(session);
      if (!registration) throw paymentError(404, "Class registration not found");
      if (req.user.role === "MEMBER") {
        const member = await Member.findOne({ userId: req.user.userId }).session(session);
        if (!member || String(member._id) !== String(registration.memberId)) throw paymentError(403, "You cannot access this payment");
      }
      if (registration.status !== "PENDING_PAYMENT") throw paymentError(409, "Registration is not awaiting payment");
      // Serialize check/create for a registration, including concurrent browser requests.
      await ClassRegistration.updateOne({ _id: registration._id }, { $inc: { __v: 1 } }, { session });
      const existing = await Payment.findOne({ classRegistrationId, status: { $in: ["PENDING", "SUCCESS"] } }).session(session);
      if (existing) {
        if (existing.status === "SUCCESS") throw paymentError(409, "Registration already has a successful payment");
        if (existing.paymentMethod !== paymentMethod) throw paymentError(409, "A payment with another method is already pending");
        if (paymentMethod === "ONLINE" && Payment.providerOf(existing) !== provider) {
          throw paymentError(409, "A payment with another provider is already pending");
        }
        return { payment: existing, registration, reused: true };
      }
      // Preserve the price agreed at registration, even if the course price changes.
      const amount = registration.priceSnapshot;
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw paymentError(400, "Registration priceSnapshot must be a positive whole VND amount");
      }
      const [payment] = await Payment.create([{
        classRegistrationId, amount, paymentMethod,
        paymentProvider: paymentMethod === "ONLINE" ? provider : undefined,
        status: "PENDING", paymentDate: null,
      }], { session });
      return { payment, registration, reused: false };
    });
    const { payment, registration, reused } = result;
    return res.status(reused ? 200 : 201).json({
      success: true, message: reused ? "Pending payment reused" : "Payment created successfully",
      data: {
        id: payment._id, classRegistrationId: payment.classRegistrationId,
        amount: payment.amount, paymentMethod: payment.paymentMethod, status: payment.status,
        paymentProvider: Payment.providerOf(payment),
        paymentDate: payment.paymentDate, registrationStatus: registration.status, createdAt: payment.createdAt,
      },
    });
  } catch (error) {
    if (!error.status) console.error("Create payment error:", error.name);
    return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Could not create payment" });
  }
};


// Gateway selection belongs to explicit endpoints, not a shared environment switch.
const createPayment = (req, res) => createPaymentForProvider(req, res, "VNPAY");
const createPayosPayment = (req, res) => createPaymentForProvider(req, res, "PAYOS");

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
const updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      classRegistrationId,
      paymentMethod,
      status,
      paymentDate,
    } = req.body;

    if (req.body.paymentProvider !== undefined) {
      throw paymentError(400, "Payment provider cannot be changed");
    }

    // Payment amount must never be changed through this endpoint.
    if (req.body.amount !== undefined) {
      return res.status(400).json({
        success: false,
        message:
          "Payment amount cannot be changed. It is determined by ClassRegistration.priceSnapshot.",
      });
    }

    if (!mongoose.isValidObjectId(id)) throw paymentError(400, "Invalid payment ID");
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
    if (payment.paymentMethod === "ONLINE" && paymentMethod !== undefined && paymentMethod !== "ONLINE") {
      return res.status(409).json({ success: false, message: "Cannot change the method of an online payment" });
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
        { $set: { paymentMethod, ...(paymentMethod === "ONLINE" ? { paymentProvider: "VNPAY" } : {}) } },
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

    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Internal server error",
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
// Only Web ONLINE payments can be simulated.
if (payment.paymentMethod !== "ONLINE" || Payment.providerOf(payment) !== "VNPAY") {
  return res.status(400).json({
    success: false,
    message: "Only Web ONLINE payments can be simulated",
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
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid payment ID" });
    }
    if (process.env.PAYMENT_MODE === "mock") {
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

    const payment = await Payment.findOne({
      _id: id,
      ...Payment.providerFilter("VNPAY"),
    }).select("+vnpayUrl +vnpayExpiresAt");

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

    if (!Number.isSafeInteger(payment.amount) || payment.amount < 5000) {
      return res.status(400).json({ success: false, message: "VNPay requires a whole VND amount of at least 5000 VND" });
    }

    if (payment.vnpayExpiresAt && payment.vnpayExpiresAt <= new Date()) {
      await Payment.updateOne({ _id: id, status: "PENDING" }, { $set: { status: "FAILED" } });
      return res.status(409).json({ success: false, message: "Payment link expired. Refresh and create a new payment." });
    }
    if (payment.vnpayUrl) {
      return res.json({ success: true, message: "Pending VNPay URL reused", data: { paymentId: payment._id, amount: payment.amount, paymentUrl: payment.vnpayUrl } });
    }
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const vnpay = getVnpay();

    const paymentUrl = vnpay.buildPaymentUrl({
      vnp_Amount: payment.amount,
      vnp_IpAddr:
        req.ip === "::1" ? "127.0.0.1" : req.ip?.replace(/^::ffff:/, "") || "127.0.0.1",
      vnp_TxnRef: payment._id.toString(),
      vnp_OrderInfo: `Payment ${payment._id}`,
      vnp_OrderType: ProductCode.Other,
      vnp_ReturnUrl: process.env.VNPAY_RETURN_URL,
      vnp_Locale: VnpLocale.VN,
      vnp_CreateDate: vnpayDate(new Date()),
      vnp_ExpireDate: vnpayDate(expiresAt),
    });

    // Concurrent requests must return the same signed URL/reference.
    const saved = await Payment.findOneAndUpdate(
      { _id: id, status: "PENDING", ...Payment.providerFilter("VNPAY"), vnpayUrl: { $exists: false } },
      { $set: { vnpayUrl: paymentUrl, vnpayExpiresAt: expiresAt } },
      { returnDocument: "after" }
    ).select("+vnpayUrl");
    const current = saved || await Payment.findById(id).select("+vnpayUrl");
    if (current?.status !== "PENDING" || Payment.providerOf(current) !== "VNPAY" || current.payosOrderCode != null || !current.vnpayUrl) {
      return res.status(409).json({ success: false, message: "Payment status changed. Please refresh." });
    }
    return res.status(200).json({
      success: true,
      message: "VNPay payment URL created",
      data: {
        paymentId: payment._id,
        amount: payment.amount,
        paymentUrl: current.vnpayUrl,
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
    const result = verifyVnpayResponse(req.query);
    const data = await applyVnpayResponse(result);
    return res.json({ success: data.status === "SUCCESS", message: data.manualRefundRequired ? "Payment succeeded, but registration is cancelled. Manual refund handling is required." : "VNPay response verified", data });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Could not process VNPay return" });
  }
};

// Authenticated browser relay: supports a direct return to the FE on localhost.
const verifyVnpayReturn = async (req, res) => {
  try {
    const result = verifyVnpayResponse(req.body);
    const data = await applyVnpayResponse(result, req.user);
    return res.json({ success: true, message: data.manualRefundRequired ? "Payment succeeded, but registration is cancelled. Manual refund handling is required." : "VNPay response verified", data });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Could not verify VNPay return" });
  }
};

const vnpayIpn = async (req, res) => {
  try {
    const result = verifyVnpayResponse(req.query, true);
    const data = await applyVnpayResponse(result);
    const alreadyConfirmed = data.duplicate && data.status === "SUCCESS";
    return res.json({
      RspCode: alreadyConfirmed ? "02" : "00",
      Message: data.manualRefundRequired
        ? "Payment successful, but registration is cancelled. Manual refund handling is required."
        : alreadyConfirmed ? "Order already confirmed" : data.duplicate ? "Payment was already processed" : "Confirm Success",
    });
  } catch (error) {
    return res.json({ RspCode: error.ipnCode || "99", Message: error.status ? error.message : "Unknown error" });
  }
};

// RECORD OFFLINE PAYMENT AT FRONT DESK

const recordOfflinePayment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) throw paymentError(400, "Invalid payment ID");
    if (req.body?.amount !== undefined) throw paymentError(400, "Payment amount cannot be changed");
    const data = await mongoose.connection.transaction(async session => {
      const payment = await Payment.findById(id).session(session);
      if (!payment) throw paymentError(404, "Payment not found");
      if (!["CASH", "BANK_TRANSFER"].includes(payment.paymentMethod)) throw paymentError(400, "Only offline payments can be recorded at reception");
      if (payment.status !== "PENDING") throw paymentError(409, "Only pending payments can be recorded");
      const registration = await ClassRegistration.findById(payment.classRegistrationId).session(session);
      if (!registration) throw paymentError(404, "Class registration not found");
      if (registration.status !== "PENDING_PAYMENT") throw paymentError(409, "Registration is not awaiting payment");
      if (payment.amount !== registration.priceSnapshot) throw paymentError(409, "Payment amount does not match the agreed tuition");
      await ClassRegistration.updateOne({ _id: registration._id }, { $inc: { __v: 1 } }, { session });
      const paid = await Payment.findOneAndUpdate(
        { _id: payment._id, status: "PENDING", paymentMethod: { $in: ["CASH", "BANK_TRANSFER"] } },
        { $set: { status: "SUCCESS", paymentDate: new Date(), recordedBy: req.user.userId } },
        { session, returnDocument: "after", runValidators: true }
      );
      if (!paid) throw paymentError(409, "Payment has already been processed");
      registration.status = "CONFIRMED";
      await registration.save({ session });
      return { paymentId: paid._id, amount: paid.amount, paymentMethod: paid.paymentMethod,
        status: paid.status, paymentDate: paid.paymentDate, recordedBy: paid.recordedBy,
        registrationId: registration._id, registrationStatus: registration.status };
    });
    return res.json({ success: true, message: "Payment recorded successfully", data });
  } catch (error) {
    if (!error.status) console.error("Record offline payment failed:", error.name);
    return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Could not record payment" });
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

    const payment = await Payment.findById(id)
      .select("amount paymentMethod paymentDate status classRegistrationId")
      .populate({
        path: "classRegistrationId",
        select: "classId memberId",
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
      }).lean();

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

    // Ownership is already available in the populated member; no extra query.
    if (req.user.role === "MEMBER") {
      if (
        !registration.memberId.userId ||
        registration.memberId.userId.toString() !== req.user.userId.toString()
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
      "_id classRegistrationId status paymentDate amount paymentMethod paymentProvider payosOrderCode"
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

    const provider = Payment.providerOf(payment);
    if (payment.status === "PENDING" && provider === "PAYOS" && payment.payosOrderCode) {
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
        paymentProvider: provider,
        manualRefundRequired: payment.status === "SUCCESS" && registration.status === "CANCELLED",
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
  createPayosPayment,
  getPayments,
  updatePayment,
  simulatePaymentResult,
  createVnpayPaymentUrl,
  vnpayReturn,
  verifyVnpayReturn,
  vnpayIpn,
  recordOfflinePayment,
  getPaymentReceipt,
  getPaymentStatusById,
};
