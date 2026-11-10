const models = Object.fromEntries(["Class", "Course", "Coach", "Lesson", "Schedule", "ClassRegistration", "Attendance",
  "LessonProgress", "WorkoutPlan", "WorkoutResult", "Homework", "SupportRequest"].map(name => [name, require("../models/" + name)]));

// Keep records that other features still reference; deletion never cascades to their history.
const dependencies = {
  coach: [["Class", "coachId"], ["WorkoutPlan", "coachId"], ["Homework", "coachId"]],
  member: [["ClassRegistration", "memberId"], ["Attendance", "memberId"], ["LessonProgress", "memberId"],
    ["WorkoutPlan", "memberId"], ["WorkoutResult", "memberId"], ["Homework", "memberId"], ["SupportRequest", "memberId"]],
  class: [["Lesson", "classId"], ["Schedule", "classId"], ["ClassRegistration", "classId"], ["Attendance", "classId"],
    ["Homework", "classId"], ["WorkoutPlan", "classId"], ["LessonProgress", "classId"]],
  lesson: [["LessonProgress", "lessonId"]],
  subject: [["Course", "subjectId"]],
  workoutPlan: [["WorkoutResult", "workoutPlanId"]],
};

async function hasDeletionDependencies(kind, record) {
  if (kind === "schedule") {
    const start = new Date(record.date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return Boolean(await models.Attendance.exists({ classId: record.classId, lessonId: record.lessonId, date: { $gte: start, $lt: end } }));
  }
  if (!dependencies[kind]) throw new Error("Unknown deletion dependency type");
  const matches = await Promise.all(dependencies[kind].map(([name, field]) => models[name].exists({ [field]: record._id })));
  return matches.some(Boolean);
}

module.exports = { hasDeletionDependencies };
