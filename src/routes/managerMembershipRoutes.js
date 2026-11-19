const { randomUUID } = require("node:crypto");
const router = require("express").Router();
const mongoose = require("mongoose");
const auth = require("../middlewares/authMiddleware");
const role = require("../middlewares/roleMiddleware");
const Member = require("../models/Member");
const Membership = require("../models/Membership");
const Plan = require("../models/MembershipPlan");

const DAY_MS = 86400000;
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const handle = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (error) {
    if (!error.status) console.error("Membership management failed:", error.message);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Không xử lý được yêu cầu gói tập." });
  }
};
const send = (res, data, status = 200) => res.status(status).json({ success: true, data });
const planView = row => ({ ...row, price: row.priceVnd, status: row.isActive ? "ACTIVE" : "INACTIVE" });

function validateId(id) {
  if (!mongoose.isObjectIdOrHexString(id)) fail(400, "Mã không hợp lệ.");
}

function planInput(body, creating) {
  const { name, price, durationDays, status } = body || {};
  if ((creating || name !== undefined) && (typeof name !== "string" || !name.trim() || name.trim().length > 120)) fail(400, "Tên gói phải có từ 1 đến 120 ký tự.");
  if ((creating || price !== undefined) && (!Number.isSafeInteger(price) || price < 0)) fail(400, "Giá gói phải là số nguyên không âm.");
  if ((creating || durationDays !== undefined) && (!Number.isSafeInteger(durationDays) || durationDays < 1 || durationDays > 3650)) fail(400, "Thời hạn phải từ 1 đến 3650 ngày.");
  if (status !== undefined && !["ACTIVE", "INACTIVE"].includes(status)) fail(400, "Trạng thái gói không hợp lệ.");
  const fields = {};
  if (name !== undefined) fields.name = name.trim();
  if (price !== undefined) fields.priceVnd = price;
  if (durationDays !== undefined) fields.durationDays = durationDays;
  if (status !== undefined) fields.isActive = status === "ACTIVE";
  if (!Object.keys(fields).length) fail(400, "Chưa có thông tin cần cập nhật.");
  return fields;
}

const latestMembership = memberId => Membership.findOne({ memberId, status: "ACTIVE" }).sort({ expiresAt: -1, _id: -1 });

async function membershipView(row, now) {
  if (!row) return null;
  const plan = await Plan.findById(row.planId).select("name priceVnd durationDays").lean();
  return { ...row, planName: plan?.name, price: plan?.priceVnd, durationDays: plan?.durationDays, status: row.expiresAt > now ? "ACTIVE" : "EXPIRED" };
}

router.use("/membership-plans", auth, role("CENTER_MANAGER"));
router.use("/members/:id/membership", auth, role("CENTER_MANAGER"));

router.get("/membership-plans", handle(async (_req, res) => {
  const plans = await Plan.find().sort({ name: 1, _id: 1 }).lean();
  send(res, plans.map(planView));
}));
router.post("/membership-plans", handle(async (req, res) => {
  const plan = await Plan.create({ ...planInput(req.body, true), code: randomUUID() });
  send(res, planView(plan.toObject()), 201);
}));
router.patch("/membership-plans/:id", handle(async (req, res) => {
  validateId(req.params.id);
  const plan = await Plan.findByIdAndUpdate(req.params.id, { $set: planInput(req.body, false) }, { returnDocument: "after", runValidators: true }).lean();
  if (!plan) fail(404, "Không tìm thấy gói tập.");
  send(res, planView(plan));
}));
router.get("/members/:id/membership", handle(async (req, res) => {
  validateId(req.params.id);
  if (!await Member.exists({ _id: req.params.id })) fail(404, "Không tìm thấy hội viên.");
  send(res, await membershipView(await latestMembership(req.params.id).lean(), new Date()));
}));

function saveMembership(renewing) {
  return handle(async (req, res) => {
    const memberId = req.params.id;
    validateId(memberId);
    const now = new Date();
    const row = await mongoose.connection.transaction(async session => {
      const member = await Member.findOneAndUpdate({ _id: memberId }, { $inc: { __v: 1 } }, { session, timestamps: false });
      if (!member) fail(404, "Không tìm thấy hội viên.");
      const current = await latestMembership(memberId).session(session);
      if (renewing && (!current || current.expiresAt.toISOString() !== req.body?.expectedExpiresAt || String(current.planId) !== req.body?.planId)) {
        fail(409, "Gói hiện tại đã thay đổi. Tải lại trước khi gia hạn.");
      }
      if (!renewing && current?.expiresAt > now) fail(409, "Hội viên đang có gói còn hiệu lực.");
      const planId = renewing ? current.planId : req.body?.planId;
      validateId(planId);
      const plan = await Plan.findOne({ _id: planId, isActive: true }).session(session);
      if (!plan) fail(404, "Không tìm thấy gói đang mở bán.");
      const extending = renewing && current.expiresAt > now;
      const expiresAt = new Date(+(extending ? current.expiresAt : now) + plan.durationDays * DAY_MS);
      if (extending) {
        current.expiresAt = expiresAt;
        current.expiryReminderSentAt = null;
        return (await current.save({ session })).toObject();
      }
      const [created] = await Membership.create([{ memberId, planId, issuedBy: req.user.userId, startsAt: now, expiresAt }], { session });
      return created.toObject();
    });
    send(res, await membershipView(row, now), renewing ? 200 : 201);
  });
}

router.post("/members/:id/membership", saveMembership(false));
router.post("/members/:id/membership/renew", saveMembership(true));

module.exports = router;
