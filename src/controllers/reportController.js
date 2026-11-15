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

module.exports = { getOverview };
