// Pure rules for QR check-in/check-out (no database access), shared by the controller and tests.

const TOKEN_PATTERN = /^[a-z\d_-]{43}$/i;

/** Error codes the front desk and the member app show, with the Vietnamese message for each. */
const CHECKIN_ERRORS = {
  TOKEN_INVALID: { status: 404, message: "Mã QR không hợp lệ." },
  TOKEN_EXPIRED: { status: 410, message: "Mã QR đã hết hạn. Nhờ hội viên lấy mã mới." },
  TOKEN_USED: { status: 409, message: "Mã QR này đã được dùng. Nhờ hội viên lấy mã mới." },
  ACCOUNT_INACTIVE: { status: 403, message: "Tài khoản hội viên đang bị khóa." },
  PENDING_APPROVAL: { status: 403, message: "Đăng ký đang chờ lễ tân xác nhận." },
  NO_ACTIVE_REGISTRATION: { status: 403, message: "Hội viên chưa có đăng ký lớp còn hiệu lực." },
  ALREADY_INSIDE: { status: 409, message: "Hội viên đang ở trung tâm. Hãy xác nhận ra." },
  NOT_INSIDE: { status: 409, message: "Hội viên chưa có lượt vào nên chưa thể xác nhận ra." },
};

class CheckInError extends Error {
  constructor(code) {
    super(CHECKIN_ERRORS[code].message);
    this.code = code;
    this.status = CHECKIN_ERRORS[code].status;
  }
}

const isTokenFormat = (token) => typeof token === "string" && TOKEN_PATTERN.test(token);

/** YYYY-MM-DD in Vietnam time. */
function vietnamDay(date = new Date()) {
  return new Date(new Date(date).getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * A confirmed registration gives access while its class still has a session today or later.
 * A class with no sessions scheduled yet also counts (the member is enrolled and may come in).
 */
function isRegistrationActive(registration, lastSessionDay, today) {
  if (!registration || registration.status !== "CONFIRMED") return false;
  return !lastSessionDay || lastSessionDay >= today;
}

/**
 * What the front desk may do for this member now.
 * - Inside the center (open visit): the next action is OUT, always allowed, even if the
 *   registration has expired since they came in.
 * - Outside: IN, allowed with an active account and an active registration (or an existing active
 *   membership, the older access the center already sells).
 */
function accessState({ accountActive, activeRegistrations = 0, pendingRegistrations = 0, hasMembership = false, openVisit = null }) {
  if (openVisit) return { nextAction: "OUT", allowed: true, code: null };
  if (!accountActive) return { nextAction: "IN", allowed: false, code: "ACCOUNT_INACTIVE" };
  if (activeRegistrations > 0 || hasMembership) return { nextAction: "IN", allowed: true, code: null };
  return { nextAction: "IN", allowed: false, code: pendingRegistrations > 0 ? "PENDING_APPROVAL" : "NO_ACTIVE_REGISTRATION" };
}

/** Status shown to the member for each registration. */
function registrationLabel(status, active) {
  if (status === "PENDING_PAYMENT") return "Chờ lễ tân xác nhận";
  if (status === "CANCELLED") return "Đã hủy";
  if (status === "CONFIRMED") return active ? "Đã xác nhận" : "Đã kết thúc";
  return status;
}

module.exports = {
  CHECKIN_ERRORS,
  CheckInError,
  TOKEN_PATTERN,
  accessState,
  isRegistrationActive,
  isTokenFormat,
  registrationLabel,
  vietnamDay,
};
