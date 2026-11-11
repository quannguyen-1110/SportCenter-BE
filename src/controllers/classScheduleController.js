const mongoose = require("mongoose");
const Class = require("../models/Class");
const Coach = require("../models/Coach");
const LearningPath = require("../models/LearningPath");
const Lesson = require("../models/Lesson");
const Room = require("../models/Room");
const Schedule = require("../models/Schedule");

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const validId = value => typeof value === "string" && mongoose.isValidObjectId(value);
const validDate = value => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const validTime = value => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const snapshot = lessons => lessons.map(lesson => ({
  id: String(lesson._id || lesson.id), title: lesson.title, description: lesson.description, order: lesson.order,
}));
const overlaps = (a, b) => a.date === b.date && a.startTime < b.endTime && a.endTime > b.startTime;

// Generated class schedules and their curriculum must commit together.
const generateClassSchedules = async (req, res) => {
  const { classId, learningPathId, courseId, coachId, newCurriculum, expectedLessons, rows } = req.body || {};
  if (!validId(classId) || !validId(learningPathId) || !validId(courseId) || !validId(coachId) ||
      typeof newCurriculum !== "boolean" || !Array.isArray(expectedLessons) ||
      expectedLessons.some(lesson => !lesson || !validId(lesson.id) || typeof lesson.title !== "string" || typeof lesson.description !== "string" || !Number.isInteger(lesson.order)) ||
      !Array.isArray(rows) || !rows.length || rows.length > 1000) {
    return res.status(400).json({ success: false, message: "Thông tin lớp, giáo án hoặc danh sách lịch học không hợp lệ (tối đa 1.000 buổi)." });
  }
  if (rows.some(row => !row || !Number.isInteger(row.lessonOrder) || row.lessonOrder < 1 ||
      !validId(row.roomId) || !validDate(row.date) || !validTime(row.startTime) ||
      !validTime(row.endTime) || row.startTime >= row.endTime)) {
    return res.status(400).json({ success: false, message: "Ngày, giờ, phòng hoặc thứ tự bài học không hợp lệ." });
  }
  try {
    const schedules = await mongoose.connection.transaction(async session => {
      // Serialize competing generation requests for this class, including retries.
      const classItem = await Class.findOneAndUpdate({ _id: classId }, { $inc: { __v: 1 } }, { session, returnDocument: "after" });
      const path = await LearningPath.findById(learningPathId).session(session);
      if (!classItem || !path) fail(404, "Không tìm thấy lớp học hoặc lộ trình.");
      if (String(classItem.courseId) !== courseId || String(classItem.coachId) !== coachId || String(path.courseId) !== courseId) {
        fail(409, "Khóa học hoặc HLV của lớp đã thay đổi. Hãy xem trước lịch học lại.");
      }
      // Requests through this endpoint also serialize shared coach/room checks.
      if (!await Coach.findOneAndUpdate({ _id: coachId }, { $inc: { __v: 1 } }, { session })) {
        fail(404, "Không tìm thấy HLV của lớp.");
      }
      const ownLessons = await Lesson.find({ classId }).sort({ order: 1 }).session(session);
      if (newCurriculum && ownLessons.length) fail(409, "Lớp đã có nội dung học. Hãy xem trước lại để dùng nội dung đã lưu.");
      let lessons = newCurriculum
        ? await Lesson.find({ learningPathId, classId: null }).sort({ order: 1 }).session(session)
        : ownLessons;
      if (!lessons.length || lessons.some(lesson => String(lesson.learningPathId) !== learningPathId || !lesson.title?.trim() || !lesson.description?.trim()) ||
          new Set(lessons.map(lesson => lesson.order)).size !== lessons.length) {
        fail(409, "Giáo án thiếu nội dung hoặc thứ tự bài học bị trùng. Hãy kiểm tra lại giáo án.");
      }
      if (JSON.stringify(snapshot(lessons)) !== JSON.stringify(snapshot(expectedLessons))) {
        fail(409, "Nội dung học đã thay đổi. Hãy xem trước lịch học lại.");
      }
      const existing = await Schedule.find({ classId, status: { $ne: "CANCELLED" } }).session(session);
      const scheduled = new Set(existing.map(item => String(item.lessonId)));
      const available = lessons.filter(lesson => !scheduled.has(String(lesson._id)));
      if (rows.length !== available.length || rows.some((row, index) => row.lessonOrder !== available[index]?.order)) {
        fail(409, "Số bài chưa xếp lịch đã thay đổi. Hãy xem trước lại để tránh tạo lịch trùng.");
      }
      const roomIds = [...new Set(rows.map(row => row.roomId))].sort();
      for (const roomId of roomIds) {
        if (!await Room.findOneAndUpdate({ _id: roomId, status: "ACTIVE" }, { $inc: { __v: 1 } }, { session })) {
          fail(409, "Phòng học không tồn tại hoặc đã ngừng hoạt động.");
        }
      }
      const coachClasses = await Class.find({ coachId }).select("_id").session(session);
      const coachClassIds = new Set(coachClasses.map(item => String(item._id)));
      const dates = rows.map(row => row.date).sort();
      const sessions = await Schedule.find({
        status: { $ne: "CANCELLED" },
        date: { $gte: new Date(dates[0] + "T00:00:00Z"), $lte: new Date(dates.at(-1) + "T23:59:59.999Z") },
        $or: [{ roomId: { $in: roomIds } }, { classId: { $in: coachClasses.map(item => item._id) } }],
      }).session(session);
      const occupied = sessions.map(item => ({ ...item.toObject(), date: item.date.toISOString().slice(0, 10) }));
      for (const [index, row] of rows.entries()) {
        if (rows.slice(0, index).some(other => overlaps(row, other))) fail(409, "Các buổi trong bản xem trước bị trùng thời gian.");
        const conflict = occupied.find(other => overlaps(row, other) &&
          (String(other.roomId) === row.roomId || coachClassIds.has(String(other.classId))));
        if (conflict) fail(409, "Phòng, lớp hoặc HLV đã có lịch trùng vào " + row.date + ". Hãy điều chỉnh lịch.");
      }
      if (newCurriculum) {
        lessons = await Lesson.insertMany(lessons.map(lesson => ({ classId, learningPathId,
          title: lesson.title, description: lesson.description, order: lesson.order })), { session });
      }
      const byOrder = new Map(lessons.map(lesson => [lesson.order, lesson._id]));
      return Schedule.insertMany(rows.map(row => ({ classId, lessonId: byOrder.get(row.lessonOrder),
        roomId: row.roomId, date: new Date(row.date + "T00:00:00Z"), startTime: row.startTime,
        endTime: row.endTime, status: "SCHEDULED" })), { session });
    });
    return res.status(201).json({ success: true, message: "Đã tạo nội dung và lịch học của lớp.", data: {
      totalRows: schedules.length, successCount: schedules.length, errorCount: 0, errors: [],
      importedSchedules: schedules.map((item, index) => ({ row: index + 2, scheduleId: String(item._id) })),
    } });
  } catch (error) {
    if (!error.status) console.error("Generate class schedules error:", error);
    return res.status(error.status || 500).json({ success: false,
      message: error.status ? error.message : "Chưa xác nhận được việc tạo lịch học. Vui lòng kiểm tra mục Buổi học trước khi thử lại." });
  }
};

module.exports = { generateClassSchedules };
