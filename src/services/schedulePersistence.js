const mongoose = require("mongoose");
const Class = require("../models/Class");
const Coach = require("../models/Coach");
const Room = require("../models/Room");
const Lesson = require("../models/Lesson");
const Schedule = require("../models/Schedule");
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

// Use the same Class -> Coach -> Room document locks as automatic generation.
// All overlap reads and the final write share a transaction snapshot.
async function persistSchedule(input, scheduleId = null) {
  return mongoose.connection.transaction(async session => {
    const previous = scheduleId ? await Schedule.findById(scheduleId).session(session) : null;
    if (scheduleId && !previous) fail(404, "Schedule not found");
    if (previous && (String(previous.classId) !== String(input.classId) || String(previous.lessonId) !== String(input.lessonId) || +previous.date !== +new Date(input.date))) {
      const day = new Date(previous.date); day.setUTCHours(0, 0, 0, 0);
      const [attendance, result] = await Promise.all([
        require("../models/Attendance").exists({ classId: previous.classId, lessonId: previous.lessonId, date: { $gte: day, $lt: new Date(+day + 86400000) } }).session(session),
        require("../models/WorkoutResult").exists({ scheduleId }).session(session),
      ]);
      if (attendance || result) fail(409, "Cannot reassign a session with attendance or training results");
    }
    const classIds = [...new Set([input.classId, previous?.classId].filter(Boolean).map(String))].sort();
    const classes = [];
    for (const classId of classIds) {
      const row = await Class.findOneAndUpdate({ _id: classId }, { $inc: { __v: 1 } }, { session, returnDocument: "after" });
      if (!row) fail(404, "Class not found");
      classes.push(row);
    }
    const assigned = classes.find(row => String(row._id) === String(input.classId));
    for (const coachId of [...new Set(classes.map(row => String(row.coachId)))].sort()) {
      if (!await Coach.findOneAndUpdate({ _id: coachId }, { $inc: { __v: 1 } }, { session })) fail(404, "Coach not found");
    }
    for (const roomId of [...new Set([input.roomId, previous?.roomId].filter(Boolean).map(String))].sort()) {
      const room = await Room.findOneAndUpdate({ _id: roomId }, { $inc: { __v: 1 } }, { session, returnDocument: "after" });
      if (!room || (roomId === String(input.roomId) && room.status !== "ACTIVE")) fail(409, "Room is unavailable");
    }
    const lesson = await Lesson.findById(input.lessonId).session(session);
    if (!lesson || String(lesson.classId) !== String(input.classId)) fail(409, "Lesson must belong to the scheduled class");
    if (input.status !== "CANCELLED") {
      const coachClasses = await Class.find({ coachId: assigned.coachId }).select("_id").session(session);
      const day = new Date(input.date); day.setUTCHours(0, 0, 0, 0);
      const conflict = await Schedule.findOne({
        ...(scheduleId ? { _id: { $ne: scheduleId } } : {}),
        date: { $gte: day, $lt: new Date(+day + 86400000) }, status: { $ne: "CANCELLED" },
        startTime: { $lt: input.endTime }, endTime: { $gt: input.startTime },
        $or: [{ roomId: input.roomId }, { classId: { $in: coachClasses.map(row => row._id) } }],
      }).session(session);
      if (conflict) fail(409, "Room, class or coach already has an overlapping schedule");
    }
    if (previous) { Object.assign(previous, input); return previous.save({ session }); }
    return (await Schedule.create([input], { session }))[0];
  });
}
module.exports = { persistSchedule };
