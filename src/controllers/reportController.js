const Attendance = require("../models/Attendance");
const CheckIn = require("../models/CheckIn");
const ClassRegistration = require("../models/ClassRegistration");
const Member = require("../models/Member");
const Membership = require("../models/Membership");
const MembershipOrder = require("../models/MembershipOrder");
const Payment = require("../models/Payment");

const TIMEZONE = "Asia/Ho_Chi_Minh";
const DAY_MS = 86_400_000;
const formats = { day: "%Y-%m-%d", week: "%G-W%V", month: "%Y-%m" };

// Parses ?from=&to=&groupBy=; defaults to the last 30 days grouped by day.
function parseRange(query) {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - 30 * DAY_MS);
  const groupBy = query.groupBy ?? "day";
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to || !formats[groupBy]) {
    return null;
  }
  // A bare date for "to" means the whole day.
  if (typeof query.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
    to.setTime(to.getTime() + DAY_MS - 1);
  }
  return { from, to, groupBy };
}

function series(Model, match, dateField, groupBy, sumField) {
  return Model.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: formats[groupBy], date: `$${dateField}`, timezone: TIMEZONE } },
        count: { $sum: 1 },
        ...(sumField ? { amount: { $sum: `$${sumField}` } } : {}),
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

function countBy(Model, match, field) {
  return Model.aggregate([{ $match: match }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }]);
}

const toMap = (rows) => Object.fromEntries(rows.map((row) => [row._id, row.count]));

// GET /api/reports/overview?from=2026-10-01&to=2026-10-31&groupBy=day|week|month
const getOverview = async (req, res) => {
  try {
    const range = parseRange(req.query);
    if (!range) {
      return res.status(400).json({
        success: false,
        message: "from/to must be valid dates (from <= to) and groupBy one of day, week, month",
      });
    }
    const { from, to, groupBy } = range;
    const now = new Date();
    const period = { $gte: from, $lte: to };

    const [
      totalMembers,
      newMembers,
      newMemberSeries,
      activeMemberships,
      expiringSoon,
      registrationStatus,
      registrationStatusInPeriod,
      registrationSeries,
      registrationsByClass,
      classRevenue,
      membershipRevenue,
      attendanceStatus,
      checkIns,
    ] = await Promise.all([
      Member.countDocuments(),
      Member.countDocuments({ createdAt: period }),
      series(Member, { createdAt: period }, "createdAt", groupBy),
      Membership.countDocuments({ status: "ACTIVE", startsAt: { $lte: now }, expiresAt: { $gt: now } }),
      Membership.countDocuments({ status: "ACTIVE", expiresAt: { $gt: now, $lte: new Date(now.getTime() + 7 * DAY_MS) } }),
      countBy(ClassRegistration, {}, "status"),
      countBy(ClassRegistration, { registeredAt: period }, "status"),
      series(ClassRegistration, { registeredAt: period }, "registeredAt", groupBy),
      ClassRegistration.aggregate([
        { $match: { status: "CONFIRMED" } },
        { $group: { _id: "$classId", confirmed: { $sum: 1 } } },
        { $lookup: { from: "classes", localField: "_id", foreignField: "_id", as: "class" } },
        { $unwind: "$class" },
        { $project: { _id: 0, classId: "$_id", name: "$class.name", classType: "$class.classType", confirmed: 1 } },
        { $sort: { confirmed: -1 } },
      ]),
      series(Payment, { status: "SUCCESS", paymentDate: period }, "paymentDate", groupBy, "amount"),
      series(MembershipOrder, { status: "SUCCESS", paidAt: period }, "paidAt", groupBy, "amount"),
      countBy(Attendance, { date: period }, "status"),
      CheckIn.countDocuments({ checkedInAt: period }),
    ]);

    // Merge both revenue sources into one time series.
    const buckets = new Map();
    for (const [source, rows] of [["classes", classRevenue], ["memberships", membershipRevenue]]) {
      for (const row of rows) {
        const bucket = buckets.get(row._id) ?? { period: row._id, classes: 0, memberships: 0, total: 0, transactions: 0 };
        bucket[source] += row.amount;
        bucket.total += row.amount;
        bucket.transactions += row.count;
        buckets.set(row._id, bucket);
      }
    }
    const revenueSeries = [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period));
    const sum = (rows) => rows.reduce((total, row) => total + row.amount, 0);

    return res.json({
      success: true,
      data: {
        range: { from, to, groupBy, timezone: TIMEZONE },
        members: {
          total: totalMembers,
          newInPeriod: newMembers,
          activeMemberships,
          expiringIn7Days: expiringSoon,
          series: newMemberSeries.map((row) => ({ period: row._id, count: row.count })),
        },
        registrations: {
          byStatus: toMap(registrationStatus),
          byStatusInPeriod: toMap(registrationStatusInPeriod),
          series: registrationSeries.map((row) => ({ period: row._id, count: row.count })),
          byClass: registrationsByClass,
        },
        revenue: {
          total: sum(classRevenue) + sum(membershipRevenue),
          classes: sum(classRevenue),
          memberships: sum(membershipRevenue),
          series: revenueSeries,
        },
        attendance: {
          byStatus: toMap(attendanceStatus),
          checkIns,
        },
      },
    });
  } catch (error) {
    console.error("Report overview error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


const User = require("../models/User");
const Coach = require("../models/Coach");
const Course = require("../models/Course");
const Class = require("../models/Class");
const Registration = require("../models/ClassRegistration");

const day = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

const getReportSummary = async (req, res) => {
  try {
    const { from, to } = req.query;
    if ((from !== undefined && !day(from)) || (to !== undefined && !day(to)) || (from && to && from > to)) {
      return res.status(400).json({ success: false, message: "Invalid report date range" });
    }
    const range = { ...(from ? { $gte: new Date(from + "T00:00:00+07:00") } : {}),
      ...(to ? { $lt: new Date(new Date(to + "T00:00:00+07:00").getTime() + 86400000) } : {}) };
    const scoped = field => Object.keys(range).length ? { [field]: range } : {};
    const [registeredAccounts, activeAccounts, members, coaches, courses, classes, registrations, paymentStatuses, revenue] = await Promise.all([
      User.countDocuments({ role: "MEMBER" }), User.countDocuments({ role: "MEMBER", status: "ACTIVE" }),
      Member.countDocuments(), Coach.countDocuments(), Course.countDocuments(), Class.countDocuments(),
      Registration.aggregate([{ $match: scoped("registeredAt") }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Payment.aggregate([{ $match: scoped("createdAt") }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Payment.aggregate([
        { $match: { status: "SUCCESS", ...scoped("paymentDate") } },
        { $lookup: { from: "classRegistrations", localField: "classRegistrationId", foreignField: "_id", as: "registration" } },
        { $unwind: { path: "$registration", preserveNullAndEmptyArrays: true } },
        { $lookup: { from: "classes", localField: "registration.classId", foreignField: "_id", as: "classItem" } },
        { $unwind: { path: "$classItem", preserveNullAndEmptyArrays: true } },
        { $lookup: { from: "courses", localField: "classItem.courseId", foreignField: "_id", as: "course" } },
        { $unwind: { path: "$course", preserveNullAndEmptyArrays: true } },
        { $facet: {
          total: [{ $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } }],
          byMonth: [{ $group: { _id: { $dateToString: { format: "%Y-%m", date: "$paymentDate", timezone: "Asia/Ho_Chi_Minh" } }, amount: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
          byClass: [{ $group: { _id: "$registration.classId", name: { $first: "$classItem.name" }, amount: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { amount: -1 } }],
          byCourse: [{ $group: { _id: "$classItem.courseId", name: { $first: "$course.name" }, amount: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { amount: -1 } }],
        } },
      ]),
    ]);
    const distribution = rows => Object.fromEntries(rows.map(row => [row._id, row.count]));
    const breakdown = revenue[0];
    return res.json({ success: true, data: {
      from: from || null, to: to || null, timezone: "Asia/Ho_Chi_Minh",
      totals: { registeredAccounts, activeAccounts, members, coaches, courses, classes },
      registrations: distribution(registrations), paymentStatuses: distribution(paymentStatuses),
      revenue: { amount: breakdown?.total[0]?.amount || 0, count: breakdown?.total[0]?.count || 0,
        byMonth: breakdown?.byMonth || [], byClass: breakdown?.byClass || [], byCourse: breakdown?.byCourse || [] },
    } });
  } catch (error) {
    console.error("Report query failed:", error.name);
    return res.status(500).json({ success: false, message: "Could not load report" });
  }
};

module.exports = { getOverview, getReportSummary };
