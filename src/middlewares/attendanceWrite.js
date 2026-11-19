const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const Schedule = require("../models/Schedule");
const Registration = require("../models/ClassRegistration");
const Class = require("../models/Class");
const Coach = require("../models/Coach");

module.exports = async (req, res, next) => {
  const fail = (status, message) => res.status(status).json({ success: false, message });
  try {
    const body = req.body || {};
    if (body.scheduleId !== undefined && !(req.method === "POST" && req.route?.path === "/coach")) {
      return fail(400, "scheduleId is only accepted by the coach attendance endpoint");
    }
    let record;
    if (req.params.id) {
      if (!mongoose.isValidObjectId(req.params.id)) return fail(400, "Invalid attendance ID");
      record = await Attendance.findById(req.params.id);
      if (!record) return fail(404, "Attendance not found");
    }
    if (req.method === "DELETE" && req.user.role !== "COACH") return next(); // Staff may correct historical records.
    const memberId = record?.memberId || body.memberId;
    const classId = record?.classId || body.classId;
    const lessonId = record?.lessonId || body.lessonId;
    const date = record?.date || body.date;
    if (!mongoose.isValidObjectId(memberId)) return fail(400, "Invalid member ID");
    let schedule;
    if (body.scheduleId) {
      if (!mongoose.isValidObjectId(body.scheduleId)) return fail(400, "Invalid schedule ID");
      schedule = await Schedule.findById(body.scheduleId);
    } else {
      if (!mongoose.isValidObjectId(classId) || !mongoose.isValidObjectId(lessonId) || Number.isNaN(new Date(date).getTime())) return fail(400, "Invalid attendance identity");
      if (record && (String(body.memberId) !== String(record.memberId) || String(body.classId) !== String(record.classId) || String(body.lessonId) !== String(record.lessonId))) {
        if (req.method !== "DELETE") return fail(400, "Attendance relationships cannot be reassigned");
      }
      const start = new Date(date); start.setUTCHours(0, 0, 0, 0);
      if (record && req.method !== "DELETE" && +start !== +new Date(record.date)) return fail(400, "Attendance date cannot be reassigned");
      const rows = await Schedule.find({ classId, lessonId, date: { $gte: start, $lt: new Date(+start + 86400000) }, status: { $ne: "CANCELLED" } });
      if (rows.length !== 1) return fail(409, "Attendance requires one unambiguous scheduled session");
      schedule = rows[0];
      if (req.method !== "DELETE") body.date = start.toISOString();
    }
    if (!schedule || schedule.status === "CANCELLED") return fail(409, "Session is missing or cancelled");
    if (req.user.role === "COACH") {
      const coach = await Coach.findOne({ userId: req.user.userId });
      if (!coach || !await Class.exists({ _id: schedule.classId, coachId: coach._id })) return fail(403, "You are not assigned to this session");
    }
    if (!await Registration.exists({ memberId, classId: schedule.classId, status: "CONFIRMED" })) return fail(403, "Confirmed class registration required");
    const day = schedule.date.toISOString().slice(0, 10);
    const startTime = Date.parse(`${day}T${schedule.startTime}:00+07:00`);
    const endTime = Date.parse(`${day}T${schedule.endTime}:00+07:00`);
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || Date.now() < startTime || Date.now() >= endTime) return fail(409, "Attendance can only be recorded during the session");
    return next();
  } catch (error) { return fail(500, "Could not validate attendance eligibility"); }
};
