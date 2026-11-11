const { PayOS } = require("@payos/node");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const ClassRegistration = require("../models/ClassRegistration");

function payosClient() {
  const { PAYOS_CLIENT_ID: clientId, PAYOS_API_KEY: apiKey, PAYOS_CHECKSUM_KEY: checksumKey } = process.env;
  return clientId && apiKey && checksumKey ? new PayOS({ clientId, apiKey, checksumKey, timeout: 8000 }) : null;
}

async function reconcilePayosPayment(client, payment, expectedLinkId) {
  // Re-read with provider constraints before contacting the gateway or updating data.
  payment = await Payment.findOne({
    _id: payment._id,
    payosOrderCode: payment.payosOrderCode,
    ...Payment.providerFilter("PAYOS"),
  });
  if (!payment || !Number.isSafeInteger(payment.payosOrderCode)) {
    throw new Error("Payment does not belong to payOS");
  }
  if (payment.status !== "PENDING") return;
  const link = await client.paymentRequests.get(payment.payosOrderCode);
  if (link.orderCode !== payment.payosOrderCode || link.amount !== payment.amount ||
      (expectedLinkId && link.id !== expectedLinkId)) {
    throw new Error("payOS order does not match the local payment");
  }
  const pending = { _id: payment._id, status: "PENDING", ...Payment.providerFilter("PAYOS"), payosOrderCode: payment.payosOrderCode };
  if (["CANCELLED", "EXPIRED"].includes(link.status) && link.amountPaid === 0) {
    await Payment.updateOne(pending, { $set: { status: "FAILED" } });
    return;
  }
  if (link.status !== "PAID" || link.amountPaid !== payment.amount || link.amountRemaining !== 0) return;

  await mongoose.connection.transaction(async (session) => {
    if (!await Payment.exists(pending).session(session)) return;
    const registration = await ClassRegistration.findById(payment.classRegistrationId).session(session);
    if (!registration || !["PENDING_PAYMENT", "CANCELLED"].includes(registration.status)) {
      throw new Error("Registration is missing or is not awaiting payment");
    }
    // Serialize with payment creation and VNPay processing on the same registration.
    await ClassRegistration.updateOne({ _id: registration._id }, { $inc: { __v: 1 } }, { session });
    const paid = await Payment.findOneAndUpdate(
      pending,
      { $set: { status: "SUCCESS", paymentDate: new Date() } },
      { session }
    );
    if (paid) {
      await ClassRegistration.updateOne(
        { _id: paid.classRegistrationId, status: "PENDING_PAYMENT" },
        { $set: { status: "CONFIRMED" } },
        { session }
      );
    }
  });
}

module.exports = { payosClient, reconcilePayosPayment };
