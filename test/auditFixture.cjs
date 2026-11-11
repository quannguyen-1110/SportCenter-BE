const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const names = ["User", "Member", "Coach", "Subject", "Course", "Class", "Room", "LearningPath", "Lesson", "Schedule", "ClassRegistration", "Payment", "Attendance", "WorkoutPlan", "WorkoutResult", "LessonProgress", "Homework", "Notification", "ActivityLog", "SupportRequest"];
const models = Object.fromEntries(names.map(name => [name, require("../src/models/" + name)]));
const password = "AuditTest!2026";
async function seed(uri) {
  const url = new URL(uri);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || !/^\/[a-z0-9_]*test[a-z0-9_]*$/i.test(url.pathname)) throw new Error("Audit requires a loopback test database");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(models).map(model => model.init()));
  const users = {}, profiles = {};
  const passwordHash = await bcrypt.hash(password, 10);
  for (const role of ["CENTER_MANAGER", "RECEPTIONIST", "COACH", "MEMBER", "OTHER_MEMBER", "OTHER_COACH"]) {
    users[role] = await models.User.create({ email: role.toLowerCase() + "@audit.example.test", fullName: "Audit " + role, phone: "0901234567", role: role.startsWith("OTHER_") ? role.slice(6) : role, passwordHash });
  }
  const subject = await models.Subject.create({ name: "Audit swimming" });
  const course = await models.Course.create({ subjectId: subject._id, name: "Audit course", description: "Course based tuition", price: 120000 });
  for (const key of ["COACH", "OTHER_COACH"]) profiles[key] = await models.Coach.create({ userId: users[key]._id, fullName: "Audit " + key, phone: "0901234567", subjectIds: [subject._id] });
  for (const key of ["MEMBER", "OTHER_MEMBER"]) profiles[key] = await models.Member.create({ userId: users[key]._id, fullName: "Audit " + key, phone: "0901234567", goal: "Learn swimming", level: "BEGINNER" });
  const cls = await models.Class.create({ name: "Audit class", subjectId: subject._id, courseId: course._id, coachId: profiles.COACH._id });
  const otherClass = await models.Class.create({ name: "Audit unrelated class", subjectId: subject._id, courseId: course._id, coachId: profiles.OTHER_COACH._id });
  const room = await models.Room.create({ roomNumber: "AUDIT-1", name: "Pool", capacity: 20 });
  const otherRoom = await models.Room.create({ roomNumber: "AUDIT-2", name: "Pool 2", capacity: 20 });
  const path = await models.LearningPath.create({ courseId: course._id, name: "Audit curriculum" });
  const lesson = await models.Lesson.create({ classId: cls._id, learningPathId: path._id, title: "Audit lesson", order: 1 });
  const otherLesson = await models.Lesson.create({ classId: otherClass._id, learningPathId: path._id, title: "Unrelated lesson", order: 1 });
  const local = new Date(Date.now() + 7 * 3600000); const date = local.toISOString().slice(0, 10);
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const time = value => String(Math.floor(value / 60)).padStart(2, "0") + ":" + String(value % 60).padStart(2, "0");
  const startTime = time(Math.max(0, minutes - 10)); const endTime = time(Math.min(1439, minutes + 10));
  const session = await models.Schedule.create({ classId: cls._id, lessonId: lesson._id, roomId: room._id, date, startTime, endTime });
  const otherSession = await models.Schedule.create({ classId: otherClass._id, lessonId: otherLesson._id, roomId: otherRoom._id, date, startTime, endTime });
  const registration = await models.ClassRegistration.create({ memberId: profiles.MEMBER._id, classId: cls._id, priceSnapshot: course.price, status: "CONFIRMED" });
  await models.ClassRegistration.create({ memberId: profiles.OTHER_MEMBER._id, classId: otherClass._id, priceSnapshot: course.price, status: "CONFIRMED" });
  return { models, users, profiles, subject, course, cls, otherClass, room, otherRoom, path, lesson, otherLesson, session, otherSession, registration, date, password };
}
module.exports = { seed, models, password };
