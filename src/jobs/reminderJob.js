const Class = require("../models/Class");
const Member = require("../models/Member");
const Membership = require("../models/Membership");
const Schedule = require("../models/Schedule");
const { notifyUsers, classAudienceUserIds, formatDate } = require("../services/notificationService");

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const EXPIRY_NOTICE_DAYS = 3;
const INTERVAL_MS = HOUR_MS;

// Reminds members whose plan ends within EXPIRY_NOTICE_DAYS and who have not renewed.
async function remindExpiringMemberships(now) {
  const expiring = await Membership.find({
    status: "ACTIVE",
    expiryReminderSentAt: null,
    expiresAt: { $gt: now, $lte: new Date(now.getTime() + EXPIRY_NOTICE_DAYS * DAY_MS) },
  }).populate("planId", "name").lean();

  for (const membership of expiring) {
    const renewed = await Membership.exists({
      memberId: membership.memberId,
      status: "ACTIVE",
      expiresAt: { $gt: membership.expiresAt },
    });
    if (!renewed) {
      const member = await Member.findById(membership.memberId).select("userId").lean();
      const daysLeft = Math.max(1, Math.ceil((membership.expiresAt - now) / DAY_MS));
      await notifyUsers(
        [member?.userId],
        "Gói tập sắp hết hạn",
        `Gói ${membership.planId?.name ?? "hội viên"} của bạn hết hạn ngày ${formatDate(membership.expiresAt)} (còn ${daysLeft} ngày). Gia hạn để tiếp tục tập luyện.`
      );
    }
    await Membership.updateOne({ _id: membership._id }, { $set: { expiryReminderSentAt: now } });
  }
  return expiring.length;
}

// Reminds members and coaches about sessions that start within the next 24 hours.
async function remindUpcomingSessions(now) {
  // Schedule.date holds the day; startTime holds HH:mm. Look at today and tomorrow, then filter precisely.
  const candidates = await Schedule.find({
    status: "SCHEDULED",
    reminderSentAt: null,
    date: { $gte: new Date(now.getTime() - DAY_MS), $lte: new Date(now.getTime() + 2 * DAY_MS) },
  }).lean();

  let sent = 0;
  for (const schedule of candidates) {
    const [hours, minutes] = schedule.startTime.split(":").map(Number);
    // Schedule dates are stored at UTC midnight of the calendar day; startTime is Vietnam time (UTC+7).
    const startsAt = new Date(new Date(schedule.date).getTime() + (hours - 7) * HOUR_MS + minutes * 60_000);
    if (startsAt <= now || startsAt > new Date(now.getTime() + DAY_MS)) continue;

    const sportClass = await Class.findById(schedule.classId).select("name").lean();
    await notifyUsers(
      await classAudienceUserIds(schedule.classId),
      "Nhắc lịch học",
      `Bạn có buổi ${sportClass?.name ?? "học"} lúc ${schedule.startTime} ngày ${formatDate(schedule.date)}.`
    );
    await Schedule.updateOne({ _id: schedule._id }, { $set: { reminderSentAt: now } });
    sent += 1;
  }
  return sent;
}

async function runReminders() {
  const now = new Date();
  try {
    const [memberships, sessions] = await Promise.all([remindExpiringMemberships(now), remindUpcomingSessions(now)]);
    if (memberships || sessions) {
      console.log(`Reminders: ${memberships} expiring memberships, ${sessions} upcoming sessions`);
    }
  } catch (error) {
    console.error("Reminder job error:", error.message);
  }
}

function startReminderJob() {
  runReminders();
  const timer = setInterval(runReminders, INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = { startReminderJob, runReminders };
