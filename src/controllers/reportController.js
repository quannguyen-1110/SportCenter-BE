const User = require("../models/User");
const Member = require("../models/Member");
const Coach = require("../models/Coach");
const Course = require("../models/Course");
const Class = require("../models/Class");
const Payment = require("../models/Payment");
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

module.exports = { getReportSummary };
