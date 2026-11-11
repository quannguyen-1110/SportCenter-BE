const assert = require("node:assert/strict");
const { test } = require("node:test");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
process.env.JWT_SECRET = "audit-test-only-secret";
process.env.VNPAY_TMN_CODE = "AUDITTEST";
process.env.VNPAY_HASH_SECRET = "audit-test-only-vnpay";
process.env.VNPAY_RETURN_URL = "http://127.0.0.1:5190/payment-result";
const { seed } = require("./auditFixture.cjs");
const app = require("../src/app");
const events = require("../src/middlewares/activityEvents");
test("SportCenter real HTTP/MongoDB four-role audit", async t => {
  const f = await seed(process.env.AUDIT_TEST_MONGO_URI);
  const { models: m, users: u, profiles: p } = f;
  const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await events.flush(); await mongoose.disconnect(); });
  const base = "http://127.0.0.1:" + server.address().port + "/api"; const tokens = {};
  async function request(path, method = "GET", body, role = "CENTER_MANAGER", rawToken) {
    const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(tokens[role] || rawToken ? { Authorization: "Bearer " + (rawToken || tokens[role]) } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const result = { status: response.status, body: response.headers.get("content-type")?.includes("json") ? await response.json() : await response.text() };
    return result;
  }
  const ok = (r, expected = 200) => { assert.equal(r.status, expected, JSON.stringify(r.body)); return r.body.data; };
  const id = row => String(row._id || row.id);
  await t.test("All four roles login through bcrypt; public signup cannot grant privileges", async () => {
    for (const role of Object.keys(u)) tokens[role] = ok(await request("/auth/login", "POST", { email: u[role].email, password: f.password }, "PUBLIC")).token;
    const created = ok(await request("/auth/register", "POST", { email: "public@audit.example.test", password: f.password, role: "CENTER_MANAGER" }, "PUBLIC"), 201);
    assert.equal(created.role, "MEMBER"); assert.equal((await request("/staff/accounts", "GET", undefined, "PUBLIC")).status, 401);
  });
  await t.test("Database role wins over JWT; inactive users lose access", async () => {
    const forgedRole = jwt.sign({ userId: u.MEMBER._id, role: "CENTER_MANAGER" }, process.env.JWT_SECRET);
    assert.equal((await request("/staff/accounts", "GET", undefined, "PUBLIC", forgedRole)).status, 403);
    await m.User.updateOne({ _id: u.OTHER_MEMBER._id }, { status: "INACTIVE" });
    assert.equal((await request("/auth/me", "GET", undefined, "OTHER_MEMBER")).status, 403);
    await m.User.updateOne({ _id: u.OTHER_MEMBER._id }, { status: "ACTIVE" });
  });
  await t.test("Manager staff controls reject role changes and receptionist escalation", async () => {
    ok(await request("/staff/accounts"));
    assert.equal((await request("/staff/accounts", "POST", { role: "CENTER_MANAGER" }, "RECEPTIONIST")).status, 403);
    assert.equal((await request("/staff/accounts/" + u.MEMBER._id, "PUT", { role: "CENTER_MANAGER" })).status, 400);
    ok(await request("/staff/accounts/" + u.MEMBER._id, "PUT", { fullName: "Updated member", phone: "0900000001" }));
    assert.equal((await m.Member.findById(p.MEMBER._id)).fullName, "Updated member");
    ok(await request("/staff/accounts", "POST", { role: "RECEPTIONIST", email: "newstaff@audit.example.test", password: f.password, fullName: "New desk", phone: "0900000000" }), 201);
  });
  await t.test("Reception creates account and profile; duplicate email has no orphan profile", async () => {
    const body = { email: "desk@audit.example.test", password: f.password, fullName: "Desk Member", phone: "0900000002", goal: "Train", role: "CENTER_MANAGER" };
    const created = ok(await request("/members/front-desk", "POST", body, "RECEPTIONIST"), 201);
    assert.equal(created.user.role, "MEMBER"); assert.equal(String(created.member.userId), created.user.id);
    assert.equal((await request("/members/front-desk", "POST", body, "RECEPTIONIST")).status, 409);
    assert.equal(await m.Member.countDocuments({ userId: created.user.id }), 1);
  });
  await t.test("Member list, training roster and schedules enforce coach assignment", async () => {
    assert.equal((await request("/members", "GET", undefined, "MEMBER")).status, 403);
    const members = ok(await request("/members", "GET", undefined, "COACH"));
    assert.deepEqual(members.map(id), [id(p.MEMBER)]);
    const sessions = ok(await request("/schedules", "GET", undefined, "COACH")); assert(sessions.every(row => String(row.classId._id) === id(f.cls)));
    assert.equal((await request("/attendances/schedule/" + f.otherSession._id, "GET", undefined, "COACH")).status, 403);
  });
  let pending, cash;
  await t.test("Registrations use course fee snapshot and reject duplicate/direct confirmation", async () => {
    pending = ok(await request("/class-registrations", "POST", { classId: f.otherClass._id, memberId: p.MEMBER._id }, "MEMBER"), 201);
    assert.equal(pending.priceSnapshot, 120000);
    assert.equal((await request("/class-registrations", "POST", { classId: f.otherClass._id }, "MEMBER")).status, 409);
    assert.equal((await request("/class-registrations/" + id(pending), "PUT", { status: "CONFIRMED" }, "MEMBER")).status, 403);
    await m.Course.updateOne({ _id: f.course._id }, { status: "INACTIVE" });
    assert.equal((await request("/class-registrations", "POST", { classId: f.cls._id, memberId: p.OTHER_MEMBER._id }, "RECEPTIONIST")).status, 409);
    await m.Course.updateOne({ _id: f.course._id }, { status: "ACTIVE", price: 150000 });
    assert.equal((await m.ClassRegistration.findById(id(pending))).priceSnapshot, 120000);
  });
  await t.test("Cash cannot override amount; concurrent confirmation produces one success and records staff", async () => {
    cash = ok(await request("/payments", "POST", { classRegistrationId: id(pending), paymentMethod: "CASH" }, "RECEPTIONIST"), 201);
    assert.equal(cash.amount, 120000);
    assert.equal((await request("/payments/" + id(cash) + "/record-payment", "POST", { amount: 1 }, "RECEPTIONIST")).status, 400);
    assert.equal((await request("/payments/" + id(cash) + "/record-payment", "POST", {}, "MEMBER")).status, 403);
    const responses = await Promise.all([1, 2].map(() => request("/payments/" + id(cash) + "/record-payment", "POST", {}, "RECEPTIONIST")));
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    const saved = await m.Payment.findById(id(cash)); assert.equal(saved.status, "SUCCESS"); assert.equal(String(saved.recordedBy), id(u.RECEPTIONIST)); assert(saved.paymentDate);
    assert.equal((await m.ClassRegistration.findById(id(pending))).status, "CONFIRMED");
  });
  await t.test("Payment ownership and receipts reflect actual backend success", async () => {
    const receipt = ok(await request("/payments/" + id(cash) + "/receipt", "GET", undefined, "MEMBER"));
    const response = await request("/payments/" + id(cash) + "/receipt", "GET", undefined, "MEMBER"); assert.equal(response.status, 200); assert(response.body.includes(id(cash)));
    assert.equal((await request("/payments/" + id(cash) + "/status", "GET", undefined, "OTHER_MEMBER")).status, 403);
    assert.equal((await request("/payments/" + id(cash) + "/receipt", "GET", undefined, "OTHER_MEMBER")).status, 403);
  });
  let plan, result;
  await t.test("Coach plans reject unrelated members and AI; members cannot read drafts", async () => {
    const body = { goal: "Technique", level: "BEGINNER", plan: "Practice breathing", status: "DRAFT" };
    assert.equal((await request("/workout-plans", "POST", { ...body, memberId: p.OTHER_MEMBER._id }, "COACH")).status, 403);
    assert.equal((await request("/workout-plans", "POST", { ...body, classId: f.cls._id, source: "AI" }, "COACH")).status, 400);
    plan = ok(await request("/workout-plans", "POST", { ...body, classId: f.cls._id }, "COACH"), 201);
    assert(!ok(await request("/workout-plans", "GET", undefined, "MEMBER")).some(row => id(row) === id(plan)));
    ok(await request("/workout-plans/" + id(plan), "PUT", { ...body, classId: f.cls._id, status: "APPROVED" }, "COACH"));
    assert(ok(await request("/workout-plans", "GET", undefined, "MEMBER")).some(row => id(row) === id(plan)));
  });
  await t.test("Class training result persists correct session; wrong coach/session rejected", async () => {
    const body = { workoutPlanId: id(plan), memberId: p.MEMBER._id, result: "Completed breathing", comment: "Good" };
    assert.equal((await request("/workout-results", "POST", { ...body, scheduleId: f.otherSession._id }, "COACH")).status, 400);
    result = ok(await request("/workout-results", "POST", { ...body, scheduleId: f.session._id }, "COACH"), 201);
    assert.equal(String(result.scheduleId), id(f.session)); assert.equal(String(result.classId), id(f.cls));
    ok(await request("/workout-results/" + id(result), "PUT", { result: "Improved", comment: "Steady" }, "COACH"));
    assert.equal((await request("/workout-results/" + id(result), "PUT", { result: "Spoofed" }, "OTHER_COACH")).status, 403);
    assert.equal((await request("/workout-results/" + id(result), "PUT", { result: "Move", memberId: p.OTHER_MEMBER._id }, "COACH")).status, 400);
    assert(!ok(await request("/workout-results", "GET", undefined, "OTHER_MEMBER")).some(row => id(row) === id(result)));
  });
  await t.test("Progress matches exact class lesson; only coach may submit evaluation", async () => {
    const body = { memberId: p.MEMBER._id, classId: f.cls._id, status: "IN_PROGRESS" };
    assert.equal((await request("/lesson-progress", "POST", { ...body, lessonId: f.otherLesson._id }, "COACH")).status, 400);
    const progress = ok(await request("/lesson-progress", "POST", { ...body, lessonId: f.lesson._id }, "COACH"), 201);
    ok(await request("/lesson-progress/" + id(progress), "PUT", { coachComment: "Keep practicing", status: "COMPLETED" }, "COACH"));
    assert.equal((await request("/lesson-progress/" + id(progress), "PUT", { coachComment: "Fake" }, "MEMBER")).status, 403);
  });
  await t.test("Homework and notifications persist atomically for the right members", async () => {
    const body = { classId: f.cls._id, title: "Practice", description: "Breathing homework" };
    const created = ok(await request("/homeworks", "POST", body, "COACH"), 201); assert.equal(created.recipientCount, 1);
    assert.equal((await request("/homeworks", "POST", { ...body, classId: f.otherClass._id }, "COACH")).status, 403);
    assert(ok(await request("/homeworks/my", "GET", undefined, "MEMBER")).some(row => id(row) === id(created.homework)));
    const note = await m.Notification.findOne({ userId: u.MEMBER._id, title: "Bài tập mới" }); assert(note);
    ok(await request("/notifications/" + note._id, "PUT", { isRead: true }, "MEMBER"));
    assert.equal((await request("/notifications/" + note._id, "PUT", { isRead: true }, "OTHER_MEMBER")).status, 404);
    assert(!ok(await request("/notifications/my", "GET", undefined, "OTHER_MEMBER")).some(row => id(row) === id(note)));
  });
  await t.test("Reception attendance requires confirmed registration and scheduled session", async () => {
    const body = { memberId: p.MEMBER._id, classId: f.cls._id, lessonId: f.lesson._id, date: f.date, status: "PRESENT" };
    ok(await request("/attendances", "POST", body, "RECEPTIONIST"), 201);
    assert.equal((await request("/attendances", "POST", body, "RECEPTIONIST")).status, 409);
    assert.equal((await request("/attendances", "POST", { ...body, memberId: p.OTHER_MEMBER._id }, "RECEPTIONIST")).status, 403);
    assert.equal((await request("/attendances", "POST", { ...body, memberId: p.OTHER_MEMBER._id, scheduleId: f.otherSession._id }, "RECEPTIONIST")).status, 400, "An unrelated scheduleId must not bypass class eligibility");
    assert.equal((await request("/attendances", "POST", body, "MEMBER")).status, 403);
    assert(ok(await request("/attendances", "GET", undefined, "MEMBER")).every(row => String(row.memberId._id) === id(p.MEMBER)));
    assert(!ok(await request("/attendances", "GET", undefined, "OTHER_COACH")).some(row => String(row.classId._id) === id(f.cls)));
  });
  await t.test("Coach attendance is denied outside the session time window", async () => {
    const future = await m.Schedule.create({ classId: f.cls._id, lessonId: f.lesson._id, roomId: f.room._id, date: "2099-01-01", startTime: "09:00", endTime: "10:00" });
    assert.equal((await request("/attendances/coach", "POST", { memberId: p.MEMBER._id, scheduleId: future._id, status: "PRESENT" }, "COACH")).status, 409);
  });
  await t.test("Room/class/coach overlaps are rejected even across different rooms", async () => {
    const body = { classId: f.cls._id, lessonId: f.lesson._id, roomId: f.otherRoom._id, date: f.date, startTime: f.session.startTime, endTime: f.session.endTime };
    assert.equal((await request("/schedules", "POST", body)).status, 409);
    assert.equal((await request("/schedules", "POST", { ...body, date: "2026-02-30" })).status, 400, "Invalid calendar dates must not roll into another month");
    assert.equal((await request("/rooms/" + f.room._id, "DELETE")).status, 409);
    assert.equal((await request("/schedules", "POST", body, "MEMBER")).status, 403);
  });
  await t.test("Support is scoped; receptionist notes and status persist", async () => {
    const support = ok(await request("/support-requests", "POST", { message: "Please help", memberId: p.OTHER_MEMBER._id }, "MEMBER"), 201);
    assert.equal(String(support.memberId._id), id(p.MEMBER));
    const updated = ok(await request("/support-requests/" + id(support) + "/status", "PUT", { status: "RESOLVED", note: "Called member" }, "RECEPTIONIST"));
    assert.equal(updated.handlingNotes[0].text, "Called member"); assert.equal(String(updated.handlingNotes[0].staffId), id(u.RECEPTIONIST)); assert(updated.resolvedAt);
    assert(!ok(await request("/support-requests", "GET", undefined, "OTHER_MEMBER")).some(row => id(row) === id(support)));
    assert.equal((await request("/support-requests/" + id(support) + "/status", "PUT", { status: "RESOLVED" }, "MEMBER")).status, 403);
  });
  await t.test("Reports count successful revenue only and apply Vietnam date boundaries", async () => {
    const report = ok(await request("/reports/summary?from=" + f.date + "&to=" + f.date));
    assert.equal(report.revenue.amount, 120000); assert.equal(report.revenue.count, 1); assert.equal(report.revenue.byCourse[0].name, f.course.name);
    assert.equal(ok(await request("/reports/summary?from=2099-01-01")).revenue.amount, 0);
    assert.equal((await request("/reports/summary?from=2026-02-30")).status, 400);
    assert.equal((await request("/reports/summary", "GET", undefined, "RECEPTIONIST")).status, 403);
  });
  await t.test("Concurrent manual schedules share room/class locks", async () => {
    const body = { date: "2098-12-01", startTime: "09:00", endTime: "10:00", roomId: f.room._id };
    const responses = await Promise.all([
      request("/schedules", "POST", { ...body, classId: f.cls._id, lessonId: f.lesson._id }),
      request("/schedules", "POST", { ...body, classId: f.otherClass._id, lessonId: f.otherLesson._id }),
    ]);
    assert.deepEqual(responses.map(row => row.status).sort(), [201, 409], JSON.stringify(responses));
    assert.equal(await m.Schedule.countDocuments({ date: new Date(body.date), roomId: f.room._id }), 1);
    assert.equal((await request("/schedules/" + f.session._id, "DELETE")).status, 409);
    assert.equal((await request("/schedules/" + f.session._id, "PUT", { ...body, classId: f.cls._id, lessonId: f.lesson._id })).status, 409);
  });
  await t.test("Homework rolls back if notification persistence fails", async () => {
    const count = await m.Homework.countDocuments(); const original = m.Notification.insertMany;
    m.Notification.insertMany = async () => { throw new Error("Injected audit failure"); };
    try { assert.equal((await request("/homeworks", "POST", { classId: f.cls._id, title: "Rollback", description: "Atomic write" }, "COACH")).status, 500); }
    finally { m.Notification.insertMany = original; }
    assert.equal(await m.Homework.countDocuments(), count);
  });
  await t.test("Activity log is automatic, cannot spoof actor and is manager-only", async () => {
    await events.flush();
    const logs = ok(await request("/activity-logs")); assert(logs.some(row => row.action.includes("record-payment")));
    assert.equal((await request("/activity-logs", "GET", undefined, "MEMBER")).status, 403);
    const log = ok(await request("/activity-logs", "POST", { action: "Manual audit", userId: u.MEMBER._id }), 201);
    assert.equal(String(log.userId), id(u.CENTER_MANAGER));
    assert(await m.Notification.exists({ userId: u.MEMBER._id, eventKey: { $regex: "^payment:" } }));
  });
  await t.test("Upcoming lesson reminders persist once for confirmed active members only", async () => {
    const { publishUpcomingLessons } = require("../src/services/lessonReminders");
    const before = new Date(f.date + "T" + f.session.startTime + ":00+07:00"); before.setMinutes(before.getMinutes() - 30);
    const first = await publishUpcomingLessons(before); assert.equal(first, 3);
    assert.equal(await publishUpcomingLessons(before), 0);
    const notes = await m.Notification.find({ title: "Nhắc lịch học sắp tới" }); assert.equal(notes.length, 3);
    assert(notes.every(note => [id(u.MEMBER), id(u.OTHER_MEMBER)].includes(String(note.userId))));
  });
  await t.test("Password change checks old password and revokes existing tokens", async () => {
    assert.equal((await request("/auth/password", "PUT", { currentPassword: "wrong", newPassword: "NewAudit!2026" }, "MEMBER")).status, 403);
    ok(await request("/auth/password", "PUT", { currentPassword: f.password, newPassword: "NewAudit!2026" }, "MEMBER"));
    assert.equal((await request("/auth/me", "GET", undefined, "MEMBER")).status, 401);
    assert.equal((await request("/auth/login", "POST", { email: u.MEMBER.email, password: f.password }, "PUBLIC")).status, 401);
    tokens.MEMBER = ok(await request("/auth/login", "POST", { email: u.MEMBER.email, password: "NewAudit!2026" }, "PUBLIC")).token;
    ok(await request("/auth/me", "GET", undefined, "MEMBER"));
  });
  await t.test("Former coach loses training access after class reassignment", async () => {
    const user = await m.User.create({ email: "replacement@audit.example.test", role: "COACH", passwordHash: "test-fixture-only" });
    const replacement = await m.Coach.create({ userId: user._id, subjectIds: [f.subject._id], fullName: "Replacement", phone: "0901234567" });
    await m.Class.updateOne({ _id: f.cls._id }, { coachId: replacement._id });
    assert(!ok(await request("/workout-results", "GET", undefined, "COACH")).some(row => id(row) === id(result)));
    assert(!ok(await request("/workout-plans", "GET", undefined, "COACH")).some(row => id(row) === id(plan)));
    assert.equal((await request("/workout-results/" + id(result), "PUT", { result: "Unauthorized after reassignment" }, "COACH")).status, 403);
  });
});
