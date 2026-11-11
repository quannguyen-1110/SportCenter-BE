const { randomInt } = require("node:crypto");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const ClassRegistration = require("../models/ClassRegistration");
const Member = require("../models/Member");
const { payosClient, reconcilePayosPayment } = require("../services/payosService");

async function createPayosCheckout(req, res) {
  const fail = (status, message) => res.status(status).json({ success: false, message });
  if (!mongoose.isValidObjectId(req.params.id)) return fail(400, "Mã thanh toán không hợp lệ.");

  try {
    const client = payosClient();
    if (!client) return fail(503, "BE chưa có đủ khóa cấu hình payOS.");
    const [payment, member] = await Promise.all([
      Payment.findOne({ _id: req.params.id, ...Payment.providerFilter("PAYOS") }),
      Member.findOne({ userId: req.user.userId }),
    ]);
    if (!payment || !member) return fail(404, "Không tìm thấy yêu cầu thanh toán.");
    const registration = await ClassRegistration.findById(payment.classRegistrationId);
    if (!registration || !registration.memberId.equals(member._id)) {
      return fail(404, "Không tìm thấy yêu cầu thanh toán.");
    }
    if (payment.status !== "PENDING" || payment.paymentMethod !== "ONLINE" ||
        registration.status !== "PENDING_PAYMENT" ||
        !Number.isSafeInteger(payment.amount) || payment.amount <= 0) {
      return fail(409, "Yêu cầu này không thể thanh toán qua payOS.");
    }

    // Reserve a stable order code before calling payOS so retries reuse the same order.
    const payable = { _id: payment._id, status: "PENDING", ...Payment.providerFilter("PAYOS") };
    const reserved = await Payment.findOneAndUpdate(
      { ...payable, payosOrderCode: { $exists: false } },
      { $set: { payosOrderCode: randomInt(1, 2 ** 48 - 1) } },
      { returnDocument: "after" }
    ) || await Payment.findOne(payable);
    if (!reserved) return fail(409, "Yêu cầu thanh toán đã thay đổi.");

    let paymentUrl = reserved.payosCheckoutUrl;
    if (!paymentUrl) {
      const orderCode = reserved.payosOrderCode;
      const localReturnUrl = `http://localhost:${process.env.PORT || 5000}/api/payments/payos/return`;
      try {
        const link = await client.paymentRequests.create({
          orderCode,
          amount: reserved.amount,
          description: `HP${String(orderCode).slice(-7)}`,
          returnUrl: process.env.PAYOS_RETURN_URL || localReturnUrl,
          cancelUrl: process.env.PAYOS_CANCEL_URL || localReturnUrl,
          expiredAt: Math.floor(Date.now() / 1000) + 3600,
        });
        paymentUrl = link.checkoutUrl;
      } catch (error) {
        // A timed-out request can leave an order already created at payOS.
        const link = await client.paymentRequests.get(orderCode);
        if (link.orderCode !== orderCode || link.amount !== reserved.amount ||
            !/^[a-f\d]{32}$/i.test(link.id) || !["PENDING", "PROCESSING"].includes(link.status)) {
          throw error;
        }
        paymentUrl = `https://pay.payos.vn/web/${link.id}`;
      }
      await Payment.updateOne({ ...payable, payosOrderCode: orderCode }, { $set: { payosCheckoutUrl: paymentUrl } });
    }
    return res.json({ success: true, data: { paymentUrl } });
  } catch (error) {
    if (error.code === 11000) return fail(409, "Đăng ký đã có yêu cầu thanh toán payOS. Vui lòng tải lại.");
    console.error("payOS checkout failed:", error.name);
    return fail(502, "Không tạo được trang thanh toán payOS. Vui lòng thử lại.");
  }
}

async function payosWebhook(req, res) {
  const client = payosClient();
  if (!client) return res.sendStatus(503);
  let event;
  try {
    event = await client.webhooks.verify(req.body);
  } catch {
    return res.sendStatus(400);
  }
  if (event.code !== "00" || !Number.isSafeInteger(event.orderCode) || !event.paymentLinkId) {
    return res.sendStatus(200);
  }
  try {
    // An unknown order can be the signed sample sent when registering the webhook.
    const payment = await Payment.findOne({
      payosOrderCode: event.orderCode,
      status: "PENDING",
      ...Payment.providerFilter("PAYOS"),
    });
    if (payment) await reconcilePayosPayment(client, payment, event.paymentLinkId);
    return res.sendStatus(200);
  } catch (error) {
    console.error("payOS webhook failed:", error.name);
    return res.sendStatus(500);
  }
}

module.exports = { createPayosCheckout, payosWebhook };
