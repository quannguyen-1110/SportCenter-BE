const { PayOS } = require("@payos/node");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const ClassRegistration = require("../models/ClassRegistration");

function payosClient() {
  const { PAYOS_CLIENT_ID: clientId, PAYOS_API_KEY: apiKey, PAYOS_CHECKSUM_KEY: checksumKey } = process.env;
  return clientId && apiKey && checksumKey ? new PayOS({ clientId, apiKey, checksumKey, timeout: 8000 }) : null;
}

async function reconcilePayosPayment(client, payment, expectedLinkId) {
  const link = await client.paymentRequests.get(payment.payosOrderCode);
  if (link.orderCode !== payment.payosOrderCode || link.amount !== payment.amount ||
      (expectedLinkId && link.id !== expectedLinkId)) {
    throw new Error("payOS order does not match the local payment");
  }
  const pending = { _id: payment._id, status: "PENDING", paymentMethod: "ONLINE", payosOrderCode: payment.payosOrderCode };
  if (["CANCELLED", "EXPIRED"].includes(link.status) && link.amountPaid === 0) {
    await Payment.updateOne(pending, { $set: { status: "FAILED" } });
    return;
  }
  if (link.status !== "PAID" || link.amountPaid !== payment.amount || link.amountRemaining !== 0) return;

  await mongoose.connection.transaction(async (session) => {
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
