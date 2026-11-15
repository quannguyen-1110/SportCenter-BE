const { createHash, randomBytes } = require("node:crypto");
const mongoose = require("mongoose");
const QRCode = require("qrcode");

const CheckIn = require("../models/CheckIn");
const CheckInToken = require("../models/CheckInToken");
const Member = require("../models/Member");
const Membership = require("../models/Membership");
const MembershipPlan = require("../models/MembershipPlan");
const MembershipOrder = require("../models/MembershipOrder");
const User = require("../models/User");

const tokenLifetimeMs = 60_000;
const millisecondsPerDay = 86_400_000;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function findActiveMembership(memberId, now) {
  return Membership.findOne({
    memberId,
    status: "ACTIVE",
    startsAt: { $lte: now },
    expiresAt: { $gt: now },
  }).sort({ expiresAt: -1 });
}

// Members and receptionists see plans on sale; a manager passing ?all=true also sees retired plans.
async function listPlans(req, res) {
  const showAll = req.user.role === "CENTER_MANAGER" && req.query.all === "true";
  const data = await MembershipPlan.find(showAll ? {} : { isActive: { $ne: false } }).sort({ name: 1 }).lean();
  res.json({ success: true, data });
}

function validPlanFields({ name, description, durationDays, priceVnd }, partial) {
  if (name !== undefined || !partial) {
    if (typeof name !== "string" || !name.trim() || name.trim().length > 120) return false;
  }
  if (description !== undefined && (typeof description !== "string" || description.length > 1000)) return false;
  if (durationDays !== undefined || !partial) {
    if (!Number.isSafeInteger(durationDays) || durationDays < 1 || durationDays > 3650) return false;
  }
  if (priceVnd !== undefined || !partial) {
    if (!Number.isSafeInteger(priceVnd) || priceVnd < 0) return false;
  }
  return true;
}

async function createPlan(req, res) {
  const { code, name, description, durationDays, priceVnd } = req.body ?? {};
  if (typeof code !== "string" || !/^[a-z\d_-]{1,40}$/i.test(code.trim())
      || !validPlanFields({ name, description, durationDays, priceVnd }, false)) {
    return res.status(400).json({ success: false, message: "Invalid plan code, name, durationDays or priceVnd" });
  }

  const data = await MembershipPlan.create({ code, name, description, durationDays, priceVnd });
  return res.status(201).json({ success: true, data });
}

// PUT /api/check-ins/plans/:id - price and duration changes apply to future sales only;
// existing memberships keep the dates they were issued with.
async function updatePlan(req, res) {
  const { id } = req.params;
  const { name, description, durationDays, priceVnd, isActive } = req.body ?? {};
  if (!mongoose.isObjectIdOrHexString(id)) {
    return res.status(400).json({ success: false, message: "Invalid plan id" });
  }
  if (!validPlanFields({ name, description, durationDays, priceVnd }, true)
      || (isActive !== undefined && typeof isActive !== "boolean")) {
    return res.status(400).json({ success: false, message: "Invalid plan fields" });
  }

  const update = {};
  for (const [key, value] of Object.entries({ name, description, durationDays, priceVnd, isActive })) {
    if (value !== undefined) update[key] = typeof value === "string" ? value.trim() : value;
  }
  const data = await MembershipPlan.findByIdAndUpdate(id, { $set: update }, { returnDocument: "after", runValidators: true });
  if (!data) return res.status(404).json({ success: false, message: "Membership plan not found" });
  return res.json({ success: true, data });
}

// DELETE /api/check-ins/plans/:id - plans that were ever sold are retired, unused plans are removed.
async function deletePlan(req, res) {
  const { id } = req.params;
  if (!mongoose.isObjectIdOrHexString(id)) {
    return res.status(400).json({ success: false, message: "Invalid plan id" });
  }
  const plan = await MembershipPlan.findById(id);
  if (!plan) return res.status(404).json({ success: false, message: "Membership plan not found" });

  const used = await Membership.exists({ planId: id }) || await MembershipOrder.exists({ planId: id });
  if (used) {
    plan.isActive = false;
    await plan.save();
    return res.json({ success: true, message: "Plan retired because it has sales history", data: plan });
  }
  await plan.deleteOne();
  return res.json({ success: true, message: "Membership plan deleted" });
}

// GET /api/check-ins/memberships/member/:memberId - front desk lookup of a member's plan status
async function getMemberMembershipStatus(req, res) {
  const { memberId } = req.params;
  if (!mongoose.isObjectIdOrHexString(memberId)) {
    return res.status(400).json({ success: false, message: "Invalid memberId" });
  }
  const member = await Member.findById(memberId).populate("userId", "email status").lean();
  if (!member) return res.status(404).json({ success: false, message: "Member not found" });

  const now = new Date();
  const memberships = await Membership.find({ memberId })
    .populate("planId", "name code durationDays priceVnd")
    .sort({ expiresAt: -1 })
    .lean();
  const active = memberships.find((item) => item.status === "ACTIVE" && item.startsAt <= now && item.expiresAt > now) ?? null;
  const daysLeft = active ? Math.ceil((active.expiresAt - now) / millisecondsPerDay) : 0;

  return res.json({
    success: true,
    data: {
      member,
      status: active ? (daysLeft <= 7 ? "EXPIRING_SOON" : "ACTIVE") : memberships.length ? "EXPIRED" : "NONE",
      daysLeft,
      active,
      memberships,
    },
  });
}

async function activateMembership(req, res) {
  const { memberId, planId } = req.body ?? {};
  if (!mongoose.isObjectIdOrHexString(memberId) || !mongoose.isObjectIdOrHexString(planId)) {
    return res.status(400).json({ success: false, message: "Valid memberId and planId are required" });
  }

  const [member, plan] = await Promise.all([
    Member.findById(memberId).lean(),
    MembershipPlan.findOne({ _id: planId, isActive: { $ne: false } }).lean(),
  ]);
  if (!member || !plan) {
    return res.status(404).json({ success: false, message: "Member or membership plan not found" });
  }
  if (!await User.exists({ _id: member.userId, role: "MEMBER", status: "ACTIVE" })) {
    return res.status(403).json({ success: false, message: "Member account is inactive" });
  }

  // Manual activation grants access immediately and starts the plan's full duration.
  const startsAt = new Date();
  const data = await Membership.create({
    memberId,
    planId,
    issuedBy: req.user.userId,
    startsAt,
    expiresAt: new Date(startsAt.getTime() + plan.durationDays * millisecondsPerDay),
  });
  return res.status(201).json({ success: true, data });
}

async function issueToken(req, res) {
  const member = await Member.findOne({ userId: req.user.userId }).lean();
  if (!member) {
    return res.status(404).json({ success: false, message: "Member profile not found" });
  }
  if (!await User.exists({ _id: req.user.userId, role: "MEMBER", status: "ACTIVE" })) {
    return res.status(403).json({ success: false, message: "Member account is inactive" });
  }

  const now = new Date();
  const membership = await findActiveMembership(member._id, now).lean();
  if (!membership) {
    return res.status(403).json({ success: false, message: "An active membership is required" });
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Math.min(now.getTime() + tokenLifetimeMs, membership.expiresAt.getTime()));
  const qrImage = await QRCode.toDataURL(token);
  await CheckInToken.create({ tokenHash: hashToken(token), memberId: member._id, expiresAt });

  res.set("Cache-Control", "no-store");
  return res.status(201).json({ success: true, data: { qrImage, expiresAt } });
}

async function confirmCheckIn(req, res) {
  const { token } = req.body ?? {};
  if (typeof token !== "string" || !/^[a-z\d_-]{43}$/i.test(token)) {
    return res.status(400).json({ success: false, message: "Invalid QR token format" });
  }

  const checkIn = await mongoose.connection.transaction(async (session) => {
    const now = new Date();
    const claimed = await CheckInToken.findOneAndUpdate(
      { tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: now } },
      { $set: { usedAt: now } },
      { session }
    );
    if (!claimed) {
      return null;
    }

    const member = await Member.findById(claimed.memberId).session(session).lean();
    const activeUser = member && await User.exists({
      _id: member.userId,
      role: "MEMBER",
      status: "ACTIVE",
    }).session(session);
    const membership = activeUser && await findActiveMembership(member._id, now).session(session);
    if (!membership) {
      const error = new Error("An active member account and membership are required");
      error.status = 403;
      throw error;
    }

    const record = await new CheckIn({
      memberId: member._id,
      membershipId: membership._id,
      checkedInBy: req.user.userId,
      checkedInAt: now,
    }).save({ session });

    return { ...record.toObject(), memberName: member.fullName };
  });

  if (!checkIn) {
    return res.status(409).json({ success: false, message: "QR code is invalid, expired or already used" });
  }
  return res.status(201).json({ success: true, data: checkIn });
}

async function listMyMemberships(req, res) {
  const member = await Member.findOne({ userId: req.user.userId }).select("_id").lean();
  if (!member) {
    return res.status(404).json({ success: false, message: "Member profile not found" });
  }

  const data = await Membership.find({ memberId: member._id })
    .select("planId startsAt expiresAt status")
    .populate("planId", "name durationDays priceVnd")
    .sort({ expiresAt: -1 })
    .lean();

  return res.json({ success: true, data });
}

module.exports = {
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  activateMembership,
  getMemberMembershipStatus,
  issueToken,
  confirmCheckIn,
  listMyMemberships,
};
