const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  CheckInError,
  accessState,
  isRegistrationActive,
  isTokenFormat,
  registrationLabel,
  vietnamDay,
} = require("../src/utils/checkInRules");

test("a confirmed registration is active until its last session day", () => {
  const confirmed = { status: "CONFIRMED" };
  assert.equal(isRegistrationActive(confirmed, "2026-12-12", "2026-11-16"), true);
  assert.equal(isRegistrationActive(confirmed, "2026-11-16", "2026-11-16"), true);
  assert.equal(isRegistrationActive(confirmed, "2026-11-15", "2026-11-16"), false);
  assert.equal(isRegistrationActive(confirmed, null, "2026-11-16"), true);
  assert.equal(isRegistrationActive({ status: "PENDING_PAYMENT" }, "2026-12-12", "2026-11-16"), false);
  assert.equal(isRegistrationActive({ status: "CANCELLED" }, "2026-12-12", "2026-11-16"), false);
});

test("inside the center the next step is always OUT, even without an active registration", () => {
  assert.deepEqual(accessState({ accountActive: false, openVisit: { _id: "v" } }), { nextAction: "OUT", allowed: true, code: null });
});

test("outside, entry needs an active account and an active registration or membership", () => {
  assert.deepEqual(accessState({ accountActive: true, activeRegistrations: 1 }), { nextAction: "IN", allowed: true, code: null });
  assert.deepEqual(accessState({ accountActive: true, hasMembership: true }), { nextAction: "IN", allowed: true, code: null });
  assert.equal(accessState({ accountActive: true, pendingRegistrations: 1 }).code, "PENDING_APPROVAL");
  assert.equal(accessState({ accountActive: true }).code, "NO_ACTIVE_REGISTRATION");
  assert.equal(accessState({ accountActive: false, activeRegistrations: 1 }).code, "ACCOUNT_INACTIVE");
});

test("labels, token format, Vietnam day and error codes", () => {
  assert.equal(registrationLabel("PENDING_PAYMENT", false), "Chờ lễ tân xác nhận");
  assert.equal(registrationLabel("CONFIRMED", true), "Đã xác nhận");
  assert.equal(registrationLabel("CONFIRMED", false), "Đã kết thúc");
  assert.equal(isTokenFormat("a".repeat(43)), true);
  assert.equal(isTokenFormat("a".repeat(42)), false);
  assert.equal(isTokenFormat("user@example.com"), false);
  assert.equal(vietnamDay(new Date("2026-11-15T18:30:00Z")), "2026-11-16");
  const error = new CheckInError("TOKEN_USED");
  assert.equal(error.status, 409);
  assert.equal(error.code, "TOKEN_USED");
});
