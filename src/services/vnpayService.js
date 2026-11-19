  const mongoose = require("mongoose");
const { VNPay } = require("vnpay");
const Payment = require("../models/Payment");
const ClassRegistration = require("../models/ClassRegistration");
const Member = require("../models/Member");

const paymentError = (status, message, ipnCode = "99") =>
  Object.assign(new Error(message), { status, ipnCode });

const getVnpay = () => new VNPay({
  tmnCode: process.env.VNPAY_TMN_CODE,
  secureSecret: process.env.VNPAY_HASH_SECRET,
  vnpayHost: "https://sandbox.vnpayment.vn",
  testMode: true,
  hashAlgorithm: "SHA512",
});

// Format explicitly in Vietnam time, regardless of the Windows/server timezone.
const vnpayDate = date => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return Number(["year", "month", "day", "hour", "minute", "second"].map(key => values[key]).join(""));
};

// The browser can relay a signed return on localhost. Only the server verifies it.
const verifyVnpayResponse = (query, ipn = false) => {
  if (!query || typeof query !== "object" || Array.isArray(query) ||
      Object.entries(query).some(([key, value]) => !key.startsWith("vnp_") || typeof value !== "string") ||
      !/^[a-f\d]{24}$/i.test(query.vnp_TxnRef || "") ||
      !/^\d+$/.test(query.vnp_Amount || "") ||
      !/^[a-f\d]{128}$/i.test(query.vnp_SecureHash || "") ||
      !/^\d{2}$/.test(query.vnp_ResponseCode || "") ||
      !/^\d{2}$/.test(query.vnp_TransactionStatus || "")) {
    throw paymentError(400, "Invalid VNPay response", "97");
  }
  const gateway = getVnpay();
  const result = ipn ? gateway.verifyIpnCall(query) : gateway.verifyReturnUrl(query);
  if (!result.isVerified || result.vnp_TmnCode !== process.env.VNPAY_TMN_CODE) {
    throw paymentError(400, "Invalid VNPay signature or merchant", "97");
  }
  return { ...result, isSuccess: result.isSuccess && result.vnp_TransactionStatus === "00" };
};

// A transaction keeps the registration and payment consistent when return/IPN race.
const applyVnpayResponse = async (result, user = null) =>
  mongoose.connection.transaction(async session => {
    const payment = await Payment.findOne({
      _id: result.vnp_TxnRef,
      ...Payment.providerFilter("VNPAY"),
    }).session(session);
    if (!payment) {
      throw paymentError(404, "VNPay payment not found", "01");
    }
    const registration = await ClassRegistration.findById(payment.classRegistrationId).session(session);
    if (!registration) throw paymentError(404, "Class registration not found", "01");
    if (user) {
      const member = await Member.findOne({ userId: user.userId }).session(session);
      if (!member || String(member._id) !== String(registration.memberId)) {
        throw paymentError(403, "You cannot access this payment");
      }
    }
    // The SDK already divides the wire amount by 100.
    if (payment.paymentMethod !== "ONLINE" || Number(result.vnp_Amount) !== payment.amount) {
      throw paymentError(400, "Payment method or amount does not match", "04");
    }
    // Both terminal states are immutable, including a late success after failure.
    const duplicate = payment.status === "SUCCESS" || payment.status === "FAILED";
    if (!duplicate) {
      if (!["PENDING_PAYMENT", "CANCELLED"].includes(registration.status)) {
        throw paymentError(409, "Registration is not awaiting payment", "02");
      }
      await ClassRegistration.updateOne({ _id: registration._id }, { $inc: { __v: 1 } }, { session });
      payment.status = result.isSuccess ? "SUCCESS" : "FAILED";
      payment.paymentDate = result.isSuccess ? new Date() : null;
      await payment.save({ session });
      if (result.isSuccess && registration.status === "PENDING_PAYMENT") {
        registration.status = "CONFIRMED";
        await registration.save({ session });
      }
    }
    return {
      paymentId: payment._id,
      status: payment.status,
      paymentDate: payment.paymentDate,
      registrationStatus: registration.status,
      manualRefundRequired: payment.status === "SUCCESS" && registration.status === "CANCELLED",
      duplicate,
    };
  });

module.exports = { getVnpay, vnpayDate, paymentError, verifyVnpayResponse, applyVnpayResponse };
