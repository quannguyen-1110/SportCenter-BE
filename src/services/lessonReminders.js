const Schedule = require("../models/Schedule");
const Registration = require("../models/ClassRegistration");
const Notification = require("../models/Notification");
const User = require("../models/User");

async function publishUpcomingLessons(now = new Date()) {
  const until = new Date(+now + 24 * 3600000);
  const calendarDay = date => new Date(+date + 7 * 3600000).toISOString().slice(0, 10);
  const schedules = await Schedule.find({ status: "SCHEDULED", date: {
    $gte: new Date(calendarDay(now)), $lt: new Date(+new Date(calendarDay(until)) + 86400000),
  } }).populate("classId", "name");
  let count = 0;
  for (const schedule of schedules) {
    if (!schedule.classId) continue;
    const day = schedule.date.toISOString().slice(0, 10);
    const starts = Date.parse(`${day}T${schedule.startTime}:00+07:00`);
    if (!Number.isFinite(starts) || starts <= +now || starts > +until) continue;
    const registrations = await Registration.find({ classId: schedule.classId._id, status: "CONFIRMED" }).populate("memberId", "userId");
    const userIds = registrations.map(row => row.memberId?.userId).filter(Boolean);
    const activeUsers = await User.find({ _id: { $in: userIds }, status: "ACTIVE" }).select("_id");
    for (const user of activeUsers) {
      const result = await Notification.updateOne({ eventKey: `upcoming:${schedule._id}:${day}:${schedule.startTime}:${user._id}` }, { $setOnInsert: {
        userId: user._id, title: "Nhắc lịch học sắp tới", isRead: false,
        message: `${schedule.classId.name}: ${day.split("-").reverse().join("/")}, ${schedule.startTime}–${schedule.endTime} (giờ Việt Nam).`,
      } }, { upsert: true });
      count += result.upsertedCount;
    }
  }
  return count;
}

function startLessonReminders() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await publishUpcomingLessons(); }
    catch (error) { console.error("Lesson reminder processing failed:", error.name); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(tick, 60000); timer.unref();
  return () => clearInterval(timer);
}
module.exports = { publishUpcomingLessons, startLessonReminders };
