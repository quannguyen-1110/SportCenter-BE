const ActivityLog = require("../models/ActivityLog");

// Resource names shown in the activity history, keyed by the /api/<resource> segment.
const resources = {
  auth: "tài khoản",
  members: "hội viên",
  coaches: "huấn luyện viên",
  subjects: "bộ môn",
  classes: "lớp học",
  "class-registrations": "đăng ký lớp",
  attendances: "điểm danh",
  "workout-plans": "kế hoạch tập",
  "workout-results": "kết quả tập",
  notifications: "thông báo",
  "support-requests": "yêu cầu hỗ trợ",
  payments: "thanh toán",
  schedules: "lịch học",
  courses: "khóa học",
  "learning-paths": "lộ trình",
  lessons: "bài học",
  "lesson-progress": "tiến độ bài học",
  rooms: "phòng tập",
  homeworks: "bài tập về nhà",
  staff: "nhân sự & phân quyền",
  "check-ins": "check-in & gói hội viên",
  "membership-orders": "đơn gói hội viên",
  ai: "trợ lý AI",
};

const verbs = { POST: "Tạo", PUT: "Cập nhật", PATCH: "Cập nhật", DELETE: "Xóa" };

// Paths that are high-volume or not user actions; they are never logged.
const skipped = [/^\/api\/payments\/payos\//, /^\/api\/payments\/vnpay/, /^\/api\/auth\/(login|google)/, /^\/api\/ai\/chat/];

function describe(method, path) {
  const resource = path.split("/")[2] ?? "";
  return `${verbs[method]} ${resources[resource] ?? resource}`;
}

// Records every successful state-changing request made by an authenticated user.
// The route-level auth middleware sets req.user before the response finishes.
function activityLogger(req, res, next) {
  if (!verbs[req.method]) return next();

  res.on("finish", () => {
    const path = req.originalUrl.split("?")[0];
    if (!req.user?.userId || res.statusCode >= 400 || skipped.some((pattern) => pattern.test(path))) {
      return;
    }

    ActivityLog.create({
      userId: req.user.userId,
      role: req.user.role,
      action: describe(req.method, path),
      method: req.method,
      path,
      statusCode: res.statusCode,
      ip: req.ip,
    }).catch((error) => console.error("Activity log error:", error.message));
  });

  return next();
}

module.exports = activityLogger;
