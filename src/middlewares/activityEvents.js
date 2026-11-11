const ActivityLog = require("../models/ActivityLog");
const Notification = require("../models/Notification");
const Registration = require("../models/ClassRegistration");
const Payment = require("../models/Payment");
const Schedule = require("../models/Schedule");
const mongoose = require("mongoose");

const pending = new Set();
const statusLabel = value => ({ PENDING: "Chờ thanh toán", SUCCESS: "Thành công", FAILED: "Thất bại",
  PENDING_PAYMENT: "Chờ thanh toán", CONFIRMED: "Đã xác nhận", CANCELLED: "Đã hủy", SCHEDULED: "Đã lên lịch", COMPLETED: "Đã hoàn thành" })[value] || value;
async function notify(userId, eventKey, title, message) {
  if (!userId) return;
  await Notification.updateOne({ eventKey }, { $setOnInsert: { userId, title, message, isRead: false } }, { upsert: true });
}
async function publish({ actor, method, path, data }) {
  if (actor && !path.startsWith("/api/activity-logs")) {
    await ActivityLog.create({ userId: actor, action: `${method} ${path}` });
  }
  if (/^\/api\/class-registrations(?:\/|$)/.test(path)) {
    const id = data?.id || data?._id;
    if (!mongoose.isValidObjectId(id)) return;
    const registration = await Registration.findById(id).populate("memberId", "userId").populate("classId", "name");
    if (registration) await notify(registration.memberId?.userId,
      `registration:${id}:${registration.status}:${registration.updatedAt?.toISOString()}`,
      "Cập nhật đăng ký lớp học", `${registration.classId?.name || "Lớp học"}: ${statusLabel(registration.status)}`);
  }
  if (/^\/api\/payments(?:\/|$)/.test(path)) {
    const id = data?.paymentId || data?.id || data?._id;
    if (!mongoose.isValidObjectId(id)) return;
    const payment = await Payment.findById(id);
    if (!payment) return;
    const registration = await Registration.findById(payment.classRegistrationId).populate("memberId", "userId");
    await notify(registration?.memberId?.userId, `payment:${id}:${payment.status}`,
      "Cập nhật thanh toán học phí", `Giao dịch ${id}: ${statusLabel(payment.status)}`);
  }
  if (/^\/api\/schedules(?:\/|$)/.test(path)) {
    const id = data?.id || data?._id;
    if (!mongoose.isValidObjectId(id)) return;
    const schedule = await Schedule.findById(id);
    if (!schedule) return;
    const registrations = await Registration.find({ classId: schedule.classId, status: "CONFIRMED" }).populate("memberId", "userId");
    await Promise.all(registrations.map(registration => notify(registration.memberId?.userId,
      `schedule:${id}:${schedule.updatedAt?.toISOString()}:${registration.memberId?.userId}`,
      "Cập nhật lịch học", `Lịch học ngày ${schedule.date.toISOString().slice(0, 10)}, ${schedule.startTime}–${schedule.endTime}: ${statusLabel(schedule.status)}`)));
  }
  if (actor && ["/api/auth/password", "/api/members/me"].includes(path)) {
    await notify(actor, `account:${actor}:${method}:${path}:${Date.now()}`, "Cập nhật tài khoản", path === "/api/auth/password" ? "Mật khẩu của bạn vừa được thay đổi. Các phiên đăng nhập trước đã hết hiệu lực." : "Hồ sơ thành viên của bạn vừa được cập nhật.");
  }
}

function activityEvents(req, res, next) {
  const originalJson = res.json;
  let body;
  res.json = function (value) { body = value; return originalJson.call(this, value); };
  res.on("finish", () => {
    const path = req.originalUrl.split("?")[0];
    const verifiedIpn = path === "/api/payments/vnpay-ipn" && ["00", "02"].includes(body?.RspCode);
    if ((!verifiedIpn && !["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) || res.statusCode >= 300 || res.statusCode < 200 || body?.success === false) return;
    const actor = req.user?.userId || (path === "/api/auth/register" ? body?.data?.id : null);
    const task = (async () => {
      let data = verifiedIpn ? { paymentId: req.query.vnp_TxnRef } : body?.data;
      if (path === "/api/payments/payos/webhook" && Number.isSafeInteger(req.body?.data?.orderCode)) {
        const payment = await Payment.findOne({ payosOrderCode: req.body.data.orderCode, ...Payment.providerFilter("PAYOS") }).select("_id");
        data = payment ? { paymentId: payment._id } : null;
      }
      await publish({ actor, method: req.method, path, data });
    })()
      .catch(error => console.error("Activity event persistence failed:", error.name))
      .finally(() => pending.delete(task));
    pending.add(task);
  });
  next();
}
activityEvents.flush = () => Promise.all([...pending]);
module.exports = activityEvents;
