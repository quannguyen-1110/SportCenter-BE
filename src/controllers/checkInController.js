const { createHash, randomBytes } = require("node:crypto");
const mongoose = require("mongoose");
const QRCode = require("qrcode");

const CheckIn = require("../models/CheckIn");
const CheckInToken = require("../models/CheckInToken");
const ClassRegistration = require("../models/ClassRegistration");
const Member = require("../models/Member");
const Membership = require("../models/Membership");
const MembershipPlan = require("../models/MembershipPlan");
const MembershipOrder = require("../models/MembershipOrder");
const Schedule = require("../models/Schedule");
const User = require("../models/User");
const {
  CHECKIN_ERRORS,
  CheckInError,
  accessState,
  isRegistrationActive,
  isTokenFormat,
  registrationLabel,
  vietnamDay,
} = require("../utils/checkInRules");

// Long enough for the front desk to scan, check the details and press confirm.
const tokenLifetimeMs = 120_000;
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

/**
 * Everything that decides whether a member may come in or go out right now:
 * class registrations (with whether each is still running), an active membership, the open visit.
 */
async function loadAccess(member, now, session = null) {
  const queries = [
    () => ClassRegistration.find({ memberId: member._id, status: { $in: ["PENDING_PAYMENT", "CONFIRMED"] } })
      .populate({
        path: "classId",
        select: "name subjectId courseId",
        populate: [{ path: "subjectId", select: "name" }, { path: "courseId", select: "name" }],
      })
      .session(session)
      .lean(),
    () => findActiveMembership(member._id, now).session(session).lean(),
    () => CheckIn.findOne({ memberId: member._id, status: "OPEN" }).session(session).lean(),
    () => User.findById(member.userId).select("role status").session(session).lean(),
  ];
  // Operations inside a transaction must not run in parallel on its session.
  const results = [];
  if (session) for (const query of queries) results.push(await query());
  const [registrations, membership, openVisit, user] = session ? results : await Promise.all(queries.map((query) => query()));

  const confirmedClassIds = registrations
    .filter((item) => item.status === "CONFIRMED" && item.classId)
    .map((item) => item.classId._id);
  const lastSessions = confirmedClassIds.length
    ? await Schedule.aggregate([
      { $match: { classId: { $in: confirmedClassIds }, status: { $ne: "CANCELLED" } } },
      { $group: { _id: "$classId", last: { $max: "$date" } } },
    ]).session(session)
    : [];
  const lastDayByClass = new Map(lastSessions.map((row) => [String(row._id), vietnamDay(row.last)]));
  const today = vietnamDay(now);

  const items = registrations.map((item) => {
    const lastSessionDay = lastDayByClass.get(String(item.classId?._id)) || null;
    const active = isRegistrationActive(item, lastSessionDay, today);
    return {
      id: item._id,
      classId: item.classId?._id || null,
      className: item.classId?.name || "",
      subjectName: item.classId?.subjectId?.name || "",
      courseName: item.classId?.courseId?.name || "",
      status: item.status,
      label: registrationLabel(item.status, active),
      active,
      lastSessionDay,
    };
  });
  const activeItems = items.filter((item) => item.active);
  const state = accessState({
    accountActive: user?.role === "MEMBER" && user?.status === "ACTIVE",
    activeRegistrations: activeItems.length,
    pendingRegistrations: items.filter((item) => item.status === "PENDING_PAYMENT").length,
    hasMembership: Boolean(membership),
    openVisit,
  });

  return {
    registrations: items,
    activeRegistrationIds: activeItems.map((item) => item.id),
    membership: membership ? { id: membership._id, expiresAt: membership.expiresAt } : null,
    openVisit: openVisit ? { id: openVisit._id, checkedInAt: openVisit.checkedInAt } : null,
    ...state,
    message: state.code ? CHECKIN_ERRORS[state.code].message : "",
  };
}

async function memberOfUser(userId) {
  const member = await Member.findOne({ userId }).select("fullName phone userId").lean();
  if (!member) {
    const error = new Error("Member profile not found");
    error.status = 404;
    throw error;
  }
  return member;
}

// GET /api/check-ins/me - the member's registrations, whether a QR can be issued, and the open visit.
async function getMyAccess(req, res) {
  const member = await memberOfUser(req.user.userId);
  const access = await loadAccess(member, new Date());
  res.set("Cache-Control", "no-store");
  return res.json({ success: true, data: { member: { id: member._id, fullName: member.fullName }, ...access } });
}

// POST /api/check-ins/tokens - a fresh single-use QR for the member's own entry or exit.
// The QR holds only a random token; the server keeps its hash. Earlier unused codes stop working.
async function issueToken(req, res) {
  const member = await memberOfUser(req.user.userId);
  const now = new Date();
  const access = await loadAccess(member, now);
  if (!access.allowed) throw new CheckInError(access.code);

  await CheckInToken.updateMany(
    { memberId: member._id, usedAt: null, expiresAt: { $gt: now } },
    { $set: { expiresAt: now } }
  );
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + tokenLifetimeMs);
  await CheckInToken.create({ tokenHash: hashToken(token), memberId: member._id, expiresAt });
  const qrImage = await QRCode.toDataURL(token, { margin: 1, width: 320 });

  res.set("Cache-Control", "no-store");
  return res.status(201).json({ success: true, data: { qrImage, expiresAt, nextAction: access.nextAction } });
}

/** The stored token for a scanned code, or the reason it cannot be used. */
async function findUsableToken(token, now) {
  if (!isTokenFormat(token)) throw new CheckInError("TOKEN_INVALID");
  const record = await CheckInToken.findOne({ tokenHash: hashToken(token) }).lean();
  if (!record) throw new CheckInError("TOKEN_INVALID");
  if (record.usedAt) throw new CheckInError("TOKEN_USED");
  if (record.expiresAt <= now) throw new CheckInError("TOKEN_EXPIRED");
  return record;
}

// POST /api/check-ins/preview { token } - front desk scan: who it is and what to confirm.
// Reading a code does not use it up and records nothing.
async function previewToken(req, res) {
  const now = new Date();
  const record = await findUsableToken(req.body?.token, now);
  const member = await Member.findById(record.memberId).select("fullName phone userId").lean();
  if (!member) throw new CheckInError("TOKEN_INVALID");
  const access = await loadAccess(member, now);

  res.set("Cache-Control", "no-store");
  return res.json({
    success: true,
    data: {
      member: { id: member._id, fullName: member.fullName, phone: member.phone || "" },
      tokenExpiresAt: record.expiresAt,
      ...access,
    },
  });
}

/** A visit as the clients see it. */
function visitView(visit, member) {
  return {
    id: visit._id,
    status: visit.status,
    checkedInAt: visit.checkedInAt,
    checkedOutAt: visit.checkedOutAt,
    member: member ? { id: member._id, fullName: member.fullName } : undefined,
  };
}

// POST /api/check-ins/confirm { token, action: "IN" | "OUT" } - the front desk confirms entry or exit.
// Using the token and writing the visit happen in one transaction: a code counts once, a member
// has at most one open visit, and a retried or double-clicked request returns the first result.
async function confirmVisit(req, res) {
  const { token, action } = req.body ?? {};
  if (!["IN", "OUT"].includes(action)) {
    return res.status(400).json({ success: false, message: "action must be IN or OUT" });
  }
  if (!isTokenFormat(token)) throw new CheckInError("TOKEN_INVALID");
  const tokenHash = hashToken(token);

  let result;
  try {
    result = await mongoose.connection.transaction(async (session) => {
      const now = new Date();
      const claimed = await CheckInToken.findOneAndUpdate(
        { tokenHash, usedAt: null, expiresAt: { $gt: now } },
        { $set: { usedAt: now } },
        { session, returnDocument: "after" }
      );
      if (!claimed) return null;

      const member = await Member.findById(claimed.memberId).select("fullName userId").session(session).lean();
      if (!member) throw new CheckInError("TOKEN_INVALID");

      if (action === "OUT") {
        // Closing an open visit is always allowed, even if the registration ended meanwhile.
        const visit = await CheckIn.findOneAndUpdate(
          { memberId: member._id, status: "OPEN" },
          { $set: { status: "CLOSED", checkedOutAt: now, checkedOutBy: req.user.userId, checkOutTokenId: claimed._id } },
          { session, returnDocument: "after" }
        );
        if (!visit) throw new CheckInError("NOT_INSIDE");
        return { visit, member };
      }

      const access = await loadAccess(member, now, session);
      if (access.openVisit) throw new CheckInError("ALREADY_INSIDE");
      if (!access.allowed) throw new CheckInError(access.code);
      const [visit] = await CheckIn.create([{
        memberId: member._id,
        classRegistrationIds: access.activeRegistrationIds,
        membershipId: access.membership?.id || null,
        status: "OPEN",
        checkedInBy: req.user.userId,
        checkedInAt: now,
        checkInTokenId: claimed._id,
      }], { session });
      return { visit, member };
    });
  } catch (error) {
    // Another code for the same member was confirmed at the same moment.
    if (error.code === 11000 && error.keyPattern?.memberId) throw new CheckInError("ALREADY_INSIDE");
    throw error;
  }

  if (result) {
    return res.status(201).json({
      success: true,
      message: action === "IN" ? "Đã xác nhận vào trung tâm." : "Đã xác nhận ra khỏi trung tâm.",
      data: { action, alreadyRecorded: false, visit: visitView(result.visit, result.member) },
    });
  }

  // The token could not be claimed: a repeat of a request that already went through, or a bad code.
  const record = await CheckInToken.findOne({ tokenHash }).lean();
  if (record?.usedAt) {
    const field = action === "IN" ? "checkInTokenId" : "checkOutTokenId";
    const visit = await CheckIn.findOne({ [field]: record._id }).populate("memberId", "fullName").lean();
    if (visit) {
      return res.json({
        success: true,
        message: "Thao tác này đã được ghi nhận trước đó.",
        data: { action, alreadyRecorded: true, visit: visitView(visit, visit.memberId) },
      });
    }
    throw new CheckInError("TOKEN_USED");
  }
  throw new CheckInError(record ? "TOKEN_EXPIRED" : "TOKEN_INVALID");
}

// POST /api/check-ins - older one-step entry, kept for existing clients: same as confirm with IN.
async function confirmCheckIn(req, res) {
  req.body = { ...(req.body ?? {}), action: "IN" };
  return confirmVisit(req, res);
}

const visitPopulate = [
  { path: "memberId", select: "fullName phone" },
  { path: "checkedInBy", select: "email role" },
  { path: "checkedOutBy", select: "email role" },
  { path: "classRegistrationIds", select: "classId", populate: { path: "classId", select: "name" } },
];

// GET /api/check-ins/visits?date=YYYY-MM-DD - front desk log for a day (Vietnam time),
// plus anyone still inside from earlier days.
async function listVisits(req, res) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || "")) ? req.query.date : vietnamDay();
  const start = new Date(`${day}T00:00:00+07:00`);
  const end = new Date(start.getTime() + millisecondsPerDay);
  const data = await CheckIn.find({ $or: [{ checkedInAt: { $gte: start, $lt: end } }, { status: "OPEN" }] })
    .populate(visitPopulate)
    .sort({ checkedInAt: -1 })
    .limit(300)
    .lean();
  return res.json({ success: true, data: { date: day, visits: data } });
}

// GET /api/check-ins/visits/me - the member's own visits, newest first.
async function listMyVisits(req, res) {
  const member = await memberOfUser(req.user.userId);
  const data = await CheckIn.find({ memberId: member._id })
    .populate(visitPopulate.slice(3))
    .sort({ checkedInAt: -1 })
    .limit(30)
    .lean();
  return res.json({ success: true, data });
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
  getMyAccess,
  previewToken,
  confirmVisit,
  listVisits,
  listMyVisits,
  loadAccess,
};
