const ClassRegistration = require("../models/ClassRegistration");
const Class = require("../models/Class");
const Coach = require("../models/Coach");
const Member = require("../models/Member");
const Notification = require("../models/Notification");

// Creates one notification per distinct user id. Never throws: a failed
// notification must not fail the business action that triggered it.
// sentBy: the user id of the person who sent it (null for automatic notifications).
async function notifyUsers(userIds, title, message, sentBy = null) {
  const unique = [...new Set(userIds.filter(Boolean).map(String))];
  if (!unique.length) return 0;
  try {
    await Notification.insertMany(unique.map((userId) => ({ userId, title, message, sentBy })), { ordered: false });
    return unique.length;
  } catch (error) {
    console.error("Notification error:", error.message);
    return 0;
  }
}

// User ids of members with a confirmed registration in the class.
async function classMemberUserIds(classId) {
  const registrations = await ClassRegistration.find({ classId, status: "CONFIRMED" }).select("memberId").lean();
  const members = await Member.find({ _id: { $in: registrations.map((item) => item.memberId) } }).select("userId").lean();
  return members.map((member) => member.userId);
}

// Members of the class plus the class's coach.
async function classAudienceUserIds(classId) {
  const [memberUserIds, sportClass] = await Promise.all([
    classMemberUserIds(classId),
    Class.findById(classId).select("coachId").lean(),
  ]);
  const coach = sportClass && await Coach.findById(sportClass.coachId).select("userId").lean();
  return [...memberUserIds, coach?.userId];
}

const formatDate = (date) => new Date(date).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

module.exports = { notifyUsers, classMemberUserIds, classAudienceUserIds, formatDate };
