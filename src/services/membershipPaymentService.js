const { randomInt } = require("node:crypto");
const mongoose = require("mongoose");

const Member = require("../models/Member");
const Membership = require("../models/Membership");
const MembershipOrder = require("../models/MembershipOrder");

const firstMembershipOrderCode = 2 ** 48;
const millisecondsPerDay = 86_400_000;

function membershipOrderCode() {
  // Class payments use codes below this range.
  return randomInt(firstMembershipOrderCode, 2 ** 49 - 1);
}

async function reconcileMembershipOrder(client, order, expectedLinkId) {
  if (order.status !== "PENDING") return order;

  const link = await client.paymentRequests.get(order.payosOrderCode);
  if (link.orderCode !== order.payosOrderCode || link.amount !== order.amount ||
      (expectedLinkId && link.id !== expectedLinkId)) {
    throw new Error("payOS order does not match the membership order");
  }

  const pending = { _id: order._id, status: "PENDING" };
  if (["CANCELLED", "EXPIRED"].includes(link.status) && link.amountPaid === 0) {
    await MembershipOrder.updateOne(pending, { $set: { status: "FAILED" } });
  } else if (link.status === "PAID" && link.amountPaid === order.amount && link.amountRemaining === 0) {
    await mongoose.connection.transaction(async (session) => {
      const now = new Date();
      const paid = await MembershipOrder.findOneAndUpdate(
        pending,
        { $set: { status: "SUCCESS", paidAt: now } },
        { session }
      );
      if (!paid) return;

      // Serialize paid renewals for the same member before reading the end date.
      const member = await Member.findOneAndUpdate(
        { _id: paid.memberId },
        { $inc: { __v: 1 } },
        { session, timestamps: false }
      );
      if (!member) throw new Error("Member for paid membership order no longer exists");

      const latest = await Membership.findOne({
        memberId: member._id,
        planId: paid.planId,
        status: "ACTIVE",
        expiresAt: { $gt: now },
      }).sort({ expiresAt: -1 }).session(session);

      const startsAt = latest?.expiresAt ?? now;
      const membership = await new Membership({
        memberId: member._id,
        planId: paid.planId,
        issuedBy: member.userId,
        startsAt,
        expiresAt: new Date(startsAt.getTime() + paid.durationDays * millisecondsPerDay),
      }).save({ session });

      await MembershipOrder.updateOne(
        { _id: paid._id },
        { $set: { membershipId: membership._id } },
        { session }
      );
    });
  }
  return MembershipOrder.findById(order._id);
}

module.exports = { firstMembershipOrderCode, membershipOrderCode, reconcileMembershipOrder };
