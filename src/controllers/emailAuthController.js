const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const PendingRegistration = require("../models/PendingRegistration");
const { sendAccountEmail } = require("../utils/emailService");

const MINUTE = 60_000;
const emailFrom = value => typeof value === "string" ? value.trim().toLowerCase() : "";
const validEmail = email => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validPassword = password => typeof password === "string" && password.length >= 6 && Buffer.byteLength(password) <= 72;
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
const otpDigest = (email, otp) => crypto.createHmac("sha256", process.env.JWT_SECRET).update(email + ":" + otp).digest("hex");
const fail = (res, status, message) => res.status(status).json({ success: false, message });

async function register(req, res) {
  const email = emailFrom(req.body?.email);
  const password = req.body?.password;
  if (!validEmail(email) || !validPassword(password)) {
    return fail(res, 400, "Nhập email hợp lệ và mật khẩu từ 6 ký tự, tối đa 72 byte.");
  }
  if (await User.exists({ email })) return fail(res, 409, "Email đã được sử dụng.");

  const otp = String(crypto.randomInt(100000, 1000000));
  const otpHash = otpDigest(email, otp);
  const passwordHash = await bcrypt.hash(password, 10);
  const now = Date.now();
  try {
    await PendingRegistration.updateOne(
      { _id: email, resendAt: { $lte: new Date(now) } },
      { $set: { passwordHash, otpHash, attempts: 0, resendAt: new Date(now + MINUTE), expiresAt: new Date(now + 5 * MINUTE) } },
      { upsert: true },
    );
  } catch (error) {
    if (error.code === 11000) return fail(res, 429, "Vui lòng đợi 60 giây giữa hai lần gửi mã.");
    throw error;
  }

  try {
    await sendAccountEmail(email, "Mã xác nhận đăng ký SportCenter", `Mã OTP của bạn là ${otp}. Mã có hiệu lực trong 5 phút.`);
  } catch (error) {
    await PendingRegistration.deleteOne({ _id: email, otpHash });
    console.error("Registration email failed:", error.code);
    return fail(res, 503, "Chưa gửi được mã OTP. Vui lòng thử lại.");
  }
  return res.status(202).json({ success: true, data: { email } });
}

async function verifyRegistration(req, res) {
  const email = emailFrom(req.body?.email);
  const otp = req.body?.otp;
  if (!validEmail(email) || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    return fail(res, 400, "Nhập email và mã OTP gồm 6 chữ số.");
  }
  const filter = { _id: email, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } };
  const otpHash = otpDigest(email, otp);
  const pending = await PendingRegistration.findOneAndDelete({ ...filter, otpHash });
  if (!pending) {
    await PendingRegistration.updateOne({ ...filter, otpHash: { $ne: otpHash } }, { $inc: { attempts: 1 } });
    return fail(res, 400, "Mã OTP sai, đã hết hạn hoặc đã hết lượt thử. Bạn có thể yêu cầu mã mới.");
  }
  try {
    const user = await User.create({ email, passwordHash: pending.passwordHash, role: "MEMBER", authProvider: "LOCAL" });
    return res.status(201).json({ success: true, data: { id: user.id, email, role: user.role, status: user.status } });
  } catch (error) {
    if (error.code === 11000) return fail(res, 409, "Email đã được sử dụng.");
    throw error;
  }
}

async function forgotPassword(req, res) {
  const email = emailFrom(req.body?.email);
  if (!validEmail(email)) return fail(res, 400, "Vui lòng nhập email hợp lệ.");

  const token = crypto.randomBytes(32).toString("hex");
  const link = new URL("/reset-password", process.env.WEB_APP_URL || "http://localhost:5173");
  link.hash = new URLSearchParams({ token }).toString();
  const now = Date.now();
  const resetTokenHash = digest(token);
  const user = await User.findOneAndUpdate(
    {
      email, status: "ACTIVE", authProvider: { $ne: "GOOGLE" },
      $or: [{ resetRequestedAt: { $exists: false } }, { resetRequestedAt: { $lte: new Date(now - MINUTE) } }],
    },
    { $set: { resetTokenHash, resetExpiresAt: new Date(now + 30 * MINUTE), resetRequestedAt: new Date(now) } },
  ).select("_id");
  if (user) {
    void sendAccountEmail(email, "Đặt lại mật khẩu SportCenter", `Mở liên kết sau để đặt lại mật khẩu (hiệu lực 30 phút):\n${link.href}`)
      .catch(async error => {
        console.error("Password reset email failed:", error.code);
        await User.updateOne({ _id: user._id, resetTokenHash }, { $unset: { resetTokenHash: 1, resetExpiresAt: 1, resetRequestedAt: 1 } });
      })
      .catch(error => console.error("Password reset cleanup failed:", error.name));
  }
  return res.status(202).json({ success: true });
}

async function resetPassword(req, res) {
  const { token, password } = req.body || {};
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token) || !validPassword(password)) {
    return fail(res, 400, "Liên kết hoặc mật khẩu không hợp lệ.");
  }
  const filter = {
    resetTokenHash: digest(token), resetExpiresAt: { $gt: new Date() },
    status: "ACTIVE", authProvider: { $ne: "GOOGLE" },
  };
  if (!await User.exists(filter)) return fail(res, 400, "Liên kết đã hết hạn hoặc đã được sử dụng.");
  const passwordHash = await bcrypt.hash(password, 10);
  filter.resetExpiresAt.$gt = new Date();
  const result = await User.updateOne(filter, {
    $set: { passwordHash },
    $unset: { resetTokenHash: 1, resetExpiresAt: 1, resetRequestedAt: 1 },
    $inc: { sessionVersion: 1 },
  });
  if (!result.modifiedCount) return fail(res, 400, "Liên kết đã hết hạn hoặc đã được sử dụng.");
  return res.json({ success: true });
}

module.exports = { register, verifyRegistration, forgotPassword, resetPassword };
