const mongoose = require("mongoose");

const Member = require("../models/Member");
const MembershipOrder = require("../models/MembershipOrder");
const MembershipPlan = require("../models/MembershipPlan");
const User = require("../models/User");
const { membershipOrderCode, reconcileMembershipOrder } = require("../services/membershipPaymentService");
const { payosClient, getOrCreateCheckoutUrl } = require("../services/payosService");

const fields = "_id planId planName durationDays amount status membershipId paidAt createdAt";

function replyError(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function publicOrder(order) {
  return {
    _id: order._id,
    planId: order.planId,
    planName: order.planName,
    durationDays: order.durationDays,
    amount: order.amount,
    status: order.status,
    membershipId: order.membershipId ?? null,
    paidAt: order.paidAt ?? null,
    createdAt: order.createdAt,
  };
}

async function findOwnOrder(req) {
  const member = await Member.findOne({ userId: req.user.userId }).select("_id");
  return member && MembershipOrder.findOne({ _id: req.params.id, memberId: member._id });
}

async function listOrders(req, res) {
  const member = await Member.findOne({ userId: req.user.userId }).select("_id");
  const data = member ? await MembershipOrder.find({ memberId: member._id })
    .select(fields).sort({ createdAt: -1 }).limit(50).lean() : [];
  return res.json({ success: true, data });
}

async function createOrder(req, res) {
  const { planId } = req.body ?? {};
  if (!mongoose.isObjectIdOrHexString(planId)) {
    return replyError(res, 400, "Mã gói tập không hợp lệ.");
  }
  const [member, plan] = await Promise.all([
    Member.findOne({ userId: req.user.userId }).select("_id"),
    MembershipPlan.findOne({ _id: planId, isActive: { $ne: false } }),
  ]);
  if (!member || !plan) return replyError(res, 404, "Không tìm thấy hội viên hoặc gói tập đang mở bán.");
  if (!await User.exists({ _id: req.user.userId, role: "MEMBER", status: "ACTIVE" })) {
    return replyError(res, 403, "Tài khoản hội viên chưa hoạt động.");
  }
  if (!Number.isSafeInteger(plan.priceVnd) || plan.priceVnd <= 0 ||
      !Number.isSafeInteger(plan.durationDays) || plan.durationDays < 1 || plan.durationDays > 3650) {
    return replyError(res, 400, "Gói này chưa hỗ trợ thanh toán PayOS.");
  }

  await MembershipOrder.init();
  const pending = { memberId: member._id, planId: plan._id, status: "PENDING" };
  let order;
  try {
    order = await MembershipOrder.findOneAndUpdate(
      pending,
      { $setOnInsert: {
        planName: plan.name,
        durationDays: plan.durationDays,
        amount: plan.priceVnd,
        payosOrderCode: membershipOrderCode(),
      } },
      { upsert: true, returnDocument: "after", runValidators: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    order = await MembershipOrder.findOne(pending);
    if (!order) throw error;
  }
  return res.json({ success: true, data: publicOrder(order) });
}

async function checkout(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return replyError(res, 400, "Mã đơn gói không hợp lệ.");
  }
  let order = await findOwnOrder(req);
  if (!order) return replyError(res, 404, "Không tìm thấy đơn gói.");
  if (order.status !== "PENDING") return replyError(res, 409, "Đơn này đã được xử lý.");
  if (!await User.exists({ _id: req.user.userId, role: "MEMBER", status: "ACTIVE" })) {
    return replyError(res, 403, "Tài khoản hội viên chưa hoạt động.");
  }

  const client = payosClient();
  if (!client) return replyError(res, 503, "BE chưa có đủ khóa cấu hình PayOS.");
  try {
    if (order.payosCheckoutUrl) {
      order = await reconcileMembershipOrder(client, order);
      if (order.status !== "PENDING") {
        return res.status(409).json({ success: false, message: "Đơn này đã được xử lý.", data: publicOrder(order) });
      }
    }
    const paymentUrl = order.payosCheckoutUrl || await getOrCreateCheckoutUrl(
      client, order.payosOrderCode, order.amount, "GOI" + String(order.payosOrderCode).slice(-7)
    );
    if (!order.payosCheckoutUrl) {
      await MembershipOrder.updateOne({ _id: order._id, status: "PENDING" }, { $set: { payosCheckoutUrl: paymentUrl } });
    }
    return res.json({ success: true, data: { ...publicOrder(order), paymentUrl } });
  } catch (error) {
    console.error("Membership checkout failed:", error.name);
    return replyError(res, 502, "Chưa mở được trang PayOS. Vui lòng thử lại.");
  }
}

async function getStatus(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return replyError(res, 400, "Mã đơn gói không hợp lệ.");
  }
  let order = await findOwnOrder(req);
  if (!order) return replyError(res, 404, "Không tìm thấy đơn gói.");
  if (order.status === "PENDING" && order.payosCheckoutUrl) {
    const client = payosClient();
    if (!client) return replyError(res, 503, "BE chưa có đủ khóa cấu hình PayOS.");
    try {
      order = await reconcileMembershipOrder(client, order);
    } catch (error) {
      console.error("Membership status check failed:", error.name);
      return replyError(res, 502, "Chưa kiểm tra được trạng thái PayOS.");
    }
  }
  return res.json({ success: true, data: publicOrder(order) });
}

module.exports = { listOrders, createOrder, checkout, getStatus };
