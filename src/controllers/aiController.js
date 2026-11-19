const mongoose = require("mongoose");

const Attendance = require("../models/Attendance");
const Class = require("../models/Class");
const ClassRegistration = require("../models/ClassRegistration");
const Coach = require("../models/Coach");
const Lesson = require("../models/Lesson");
const Member = require("../models/Member");
const Membership = require("../models/Membership");
const MembershipPlan = require("../models/MembershipPlan");
const Schedule = require("../models/Schedule");
const WorkoutPlan = require("../models/WorkoutPlan");
const WorkoutResult = require("../models/WorkoutResult");
const { ask, isConfigurationError, APIError } = require("../services/aiService");

const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const DAY_MS = 86_400_000;

const suggestionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "goal", "level", "sessions", "progression", "cautions"],
  properties: {
    summary: { type: "string", description: "Why this plan fits, 2-3 sentences" },
    goal: { type: "string" },
    level: { type: "string", enum: LEVELS },
    sessions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["day", "focus", "exercises"],
        properties: {
          day: { type: "string", description: "e.g. Buổi 1 or Thứ 2" },
          focus: { type: "string" },
          exercises: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "sets", "reps", "rest", "notes"],
              properties: {
                name: { type: "string" },
                sets: { type: "string" },
                reps: { type: "string", description: "Reps, time or distance" },
                rest: { type: "string" },
                notes: { type: "string" },
              },
            },
          },
        },
      },
    },
    progression: { type: "string", description: "How to progress over the next 2-4 weeks" },
    cautions: { type: "array", items: { type: "string" } },
  },
};

const coachSystem = `Bạn là trợ lý chuyên môn của huấn luyện viên tại trung tâm thể thao SportHub.
Dựa trên mục tiêu, trình độ và lịch sử tập luyện được cung cấp, đề xuất kế hoạch tập luyện cụ thể, an toàn, phù hợp với bộ môn của lớp.
Trả lời bằng tiếng Việt. Kế hoạch là bản nháp để huấn luyện viên xem lại và chỉnh sửa trước khi giao cho học viên.
Không đưa ra chẩn đoán y tế; nếu dữ liệu cho thấy rủi ro chấn thương, ghi rõ trong cautions.`;

function sendError(res, error, context) {
  if (isConfigurationError(error)) {
    console.error(`${context} AI configuration error:`, error.message);
    return res.status(503).json({ success: false, message: "AI chưa được cấu hình trên máy chủ (thiếu hoặc sai ANTHROPIC_API_KEY)." });
  }
  if (error instanceof APIError) {
    console.error(`${context} AI API error:`, error.status, error.message);
    return res.status(502).json({ success: false, message: "Dịch vụ AI tạm thời không phản hồi. Vui lòng thử lại." });
  }
  if (error.status === 422) {
    return res.status(422).json({ success: false, message: "AI không thể trả lời yêu cầu này." });
  }
  console.error(`${context} error:`, error);
  return res.status(500).json({ success: false, message: "Internal server error" });
}

function planText(suggestion) {
  const sessions = suggestion.sessions.map((session) => [
    `${session.day} - ${session.focus}`,
    ...session.exercises.map((item) =>
      `  • ${item.name}: ${item.sets} x ${item.reps}, nghỉ ${item.rest}${item.notes ? ` (${item.notes})` : ""}`),
  ].join("\n"));
  return [
    suggestion.summary,
    "",
    ...sessions,
    "",
    `Tiến độ: ${suggestion.progression}`,
    ...(suggestion.cautions.length ? ["", "Lưu ý:", ...suggestion.cautions.map((item) => `- ${item}`)] : []),
  ].join("\n");
}

async function memberHistory(memberId, classIds) {
  const since = new Date(Date.now() - 60 * DAY_MS);
  const [attendance, results, plans] = await Promise.all([
    Attendance.aggregate([
      { $match: { memberId: new mongoose.Types.ObjectId(String(memberId)), classId: { $in: classIds }, date: { $gte: since } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    WorkoutResult.find({ memberId }).sort({ createdAt: -1 }).limit(10)
      .populate("workoutPlanId", "goal level").lean(),
    WorkoutPlan.find({ memberId }).sort({ createdAt: -1 }).limit(3).select("goal level plan status createdAt").lean(),
  ]);
  return {
    attendanceLast60Days: Object.fromEntries(attendance.map((row) => [row._id, row.count])),
    recentResults: results.map((item) => ({
      date: item.createdAt, result: item.result, coachComment: item.comment, planGoal: item.workoutPlanId?.goal,
    })),
    recentPlans: plans.map((item) => ({ date: item.createdAt, goal: item.goal, level: item.level, status: item.status, plan: item.plan.slice(0, 1500) })),
  };
}

// POST /api/ai/workout-suggestions  { memberId? | classId?, notes?, save? }
const suggestWorkout = async (req, res) => {
  try {
    const { memberId, classId, notes, save } = req.body ?? {};
    if (Boolean(memberId) === Boolean(classId)) {
      return res.status(400).json({ success: false, message: "Provide exactly one of memberId or classId" });
    }
    if ((memberId && !mongoose.isValidObjectId(memberId)) || (classId && !mongoose.isValidObjectId(classId))) {
      return res.status(400).json({ success: false, message: "Invalid memberId or classId" });
    }
    if (notes !== undefined && (typeof notes !== "string" || notes.length > 2000)) {
      return res.status(400).json({ success: false, message: "notes must be a string up to 2000 characters" });
    }

    const coach = await Coach.findOne({ userId: req.user.userId }).populate("subjectId", "name").lean();
    if (!coach) return res.status(404).json({ success: false, message: "Coach profile not found" });

    const classes = await Class.find({ coachId: coach._id }).populate("subjectId", "name").lean();
    const classIds = classes.map((item) => item._id);
    let context;
    let target;

    if (classId) {
      const sportClass = classes.find((item) => String(item._id) === String(classId));
      if (!sportClass) return res.status(403).json({ success: false, message: "You do not teach this class" });

      const registrations = await ClassRegistration.find({ classId, status: "CONFIRMED" })
        .populate("memberId", "goal level").lean();
      const lessons = await Lesson.find({ classId }).sort({ order: 1 }).select("title description order").lean();
      context = {
        class: { name: sportClass.name, subject: sportClass.subjectId?.name, type: sportClass.classType },
        students: registrations.filter((item) => item.memberId)
          .map((item) => ({ goal: item.memberId.goal, level: item.memberId.level })),
        curriculum: lessons.map((item) => ({ order: item.order, title: item.title, description: item.description })),
      };
      target = { classId };
    } else {
      const registration = await ClassRegistration.findOne({ memberId, classId: { $in: classIds }, status: "CONFIRMED" })
        .populate({ path: "classId", select: "name classType subjectId", populate: { path: "subjectId", select: "name" } })
        .lean();
      if (!registration) return res.status(403).json({ success: false, message: "This member is not in your classes" });

      const member = await Member.findById(memberId).select("goal level").lean();
      context = {
        class: { name: registration.classId.name, subject: registration.classId.subjectId?.name, type: registration.classId.classType },
        student: { goal: member.goal, level: member.level },
        ...await memberHistory(memberId, classIds),
      };
      target = { memberId, classId: registration.classId._id };
    }

    const scope = classId ? "cả lớp" : "học viên này";
    const suggestion = await ask({
      system: coachSystem,
      effort: "medium",
      schema: suggestionSchema,
      messages: [{
        role: "user",
        content: `Đề xuất kế hoạch tập 1 tuần cho ${scope}.\n\nDữ liệu (JSON):\n${JSON.stringify(context)}`
          + (notes?.trim() ? `\n\nGhi chú của huấn luyện viên: ${notes.trim()}` : ""),
      }],
    });

    let workoutPlan = null;
    if (save === true) {
      workoutPlan = await WorkoutPlan.create({
        coachId: coach._id,
        memberId: target.memberId ?? null,
        classId: target.memberId ? null : target.classId,
        goal: suggestion.goal,
        level: suggestion.level,
        plan: planText(suggestion),
        source: "AI",
        status: "DRAFT",
      });
    }

    return res.json({ success: true, data: { suggestion, text: planText(suggestion), workoutPlan } });
  } catch (error) {
    return sendError(res, error, "Workout suggestion");
  }
};

async function memberContext(userId) {
  const now = new Date();
  const member = await Member.findOne({ userId }).lean();
  const memberId = member?._id;
  const [memberships, plans, classes, registrations, workoutPlans] = await Promise.all([
    memberId ? Membership.find({ memberId }).populate("planId", "name").sort({ expiresAt: -1 }).limit(3).lean() : [],
    MembershipPlan.find({ isActive: { $ne: false } }).select("name description durationDays priceVnd").lean(),
    Class.find().populate("subjectId", "name").populate("coachId", "fullName").populate("courseId", "name pricing status").lean(),
    memberId ? ClassRegistration.find({ memberId, status: { $ne: "CANCELLED" } }).select("classId status").lean() : [],
    memberId ? WorkoutPlan.find({ memberId }).sort({ createdAt: -1 }).limit(2).select("goal level plan status").lean() : [],
  ]);
  const myClassIds = registrations.filter((item) => item.status === "CONFIRMED").map((item) => item.classId);
  const schedules = myClassIds.length
    ? await Schedule.find({ classId: { $in: myClassIds }, status: "SCHEDULED", date: { $gte: new Date(now.getTime() - DAY_MS), $lte: new Date(now.getTime() + 14 * DAY_MS) } })
      .populate("classId", "name").populate("roomId", "name roomNumber").sort({ date: 1, startTime: 1 }).limit(30).lean()
    : [];

  return {
    today: now.toISOString().slice(0, 10),
    member: member ? { name: member.fullName, goal: member.goal, level: member.level } : null,
    memberships: memberships.map((item) => ({ plan: item.planId?.name, startsAt: item.startsAt, expiresAt: item.expiresAt, status: item.status })),
    upcomingSessions: schedules.map((item) => ({
      class: item.classId?.name, date: item.date.toISOString().slice(0, 10), start: item.startTime, end: item.endTime,
      room: item.roomId?.name ?? item.roomId?.roomNumber,
    })),
    myRegistrations: registrations.map((item) => ({ classId: item.classId, status: item.status })),
    myWorkoutPlans: workoutPlans.map((item) => ({ goal: item.goal, level: item.level, status: item.status, plan: item.plan.slice(0, 1500) })),
    membershipPlans: plans,
    classes: classes.filter((item) => item.courseId?.status !== "INACTIVE").map((item) => ({
      id: item._id, name: item.name, subject: item.subjectId?.name, coach: item.coachId?.fullName,
      type: item.classType, course: item.courseId?.name, pricing: item.courseId?.pricing,
    })),
  };
}

// POST /api/ai/chat  { messages: [{ role: "user" | "assistant", content }] }
const chat = async (req, res) => {
  try {
    const { messages } = req.body ?? {};
    const valid = Array.isArray(messages) && messages.length > 0 && messages.length <= 20
      && messages.every((item) => ["user", "assistant"].includes(item?.role)
        && typeof item.content === "string" && item.content.trim() && item.content.length <= 2000)
      && messages[0].role === "user" && messages.at(-1).role === "user";
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: "messages must be 1-20 items of { role: user|assistant, content }, starting and ending with user",
      });
    }

    const context = await memberContext(req.user.userId);
    const system = `Bạn là trợ lý ảo của trung tâm thể thao SportHub, trả lời hội viên bằng tiếng Việt, ngắn gọn và thân thiện.
Bạn giúp về: lịch tập của hội viên, gợi ý bài tập chung phù hợp mục tiêu và trình độ, các lớp học, gói hội viên, giá và dịch vụ của trung tâm.
Chỉ dùng dữ liệu trung tâm dưới đây cho thông tin về lịch, lớp, giá; nếu không có dữ liệu thì nói rõ và đề nghị liên hệ lễ tân.
Không tự đăng ký, hủy hay thanh toán thay hội viên; hướng dẫn họ thao tác trong ứng dụng.
Với câu hỏi sức khỏe nghiêm trọng hoặc chấn thương, khuyên gặp bác sĩ hoặc huấn luyện viên.

Dữ liệu trung tâm và hội viên (JSON):
${JSON.stringify(context)}`;

    const reply = await ask({
      system,
      effort: "low",
      messages: messages.map((item) => ({ role: item.role, content: item.content.trim() })),
    });

    return res.json({ success: true, data: { reply } });
  } catch (error) {
    return sendError(res, error, "AI chat");
  }
};

module.exports = { suggestWorkout, chat };
