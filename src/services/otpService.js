
const crypto = require("crypto");
const EmailOTP = require("../models/EmailOTP");
const { sendGoogleLoginOTP } = require("../utils/emailService");

const OTP_EXPIRY_MINUTES = 5;
const OTP_RESEND_SECONDS = 60;
const MAX_ATTEMPTS = 5;

function hashOTP(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

async function sendOTP(email) {
  const normalizedEmail = email.toLowerCase().trim();

  const existingOTP = await EmailOTP.findOne({
    email: normalizedEmail,
    purpose: "GOOGLE_LOGIN",
  }).sort({ createdAt: -1 });

  if (existingOTP) {
    const elapsedSeconds =
      (Date.now() - existingOTP.createdAt.getTime()) / 1000;

    if (elapsedSeconds < OTP_RESEND_SECONDS) {
      throw new Error("Please wait before requesting another OTP");
    }
  }

  const otp = crypto.randomInt(100000, 1000000).toString();

  // Send first, then persist so a mail failure does not leave a valid OTP.
  await sendGoogleLoginOTP(normalizedEmail, otp);

  await EmailOTP.deleteMany({
    email: normalizedEmail,
    purpose: "GOOGLE_LOGIN",
  });

  await EmailOTP.create({
    email: normalizedEmail,
    otpHash: hashOTP(otp),
    purpose: "GOOGLE_LOGIN",
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    attempts: 0,
    verified: false,
  });

  return { message: "OTP sent to your email" };
}

async function verifyOTP(email, otp) {
  const normalizedEmail = email.toLowerCase().trim();

  const record = await EmailOTP.findOne({
    email: normalizedEmail,
    purpose: "GOOGLE_LOGIN",
    verified: false,
    expiresAt: { $gt: new Date() },
  }).select("+otpHash");

  if (!record) {
    throw new Error("OTP is invalid or expired");
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await EmailOTP.deleteOne({ _id: record._id });
    throw new Error("Too many incorrect attempts. Request a new OTP");
  }

  const suppliedHash = hashOTP(String(otp));

  if (suppliedHash !== record.otpHash) {
    record.attempts += 1;

    if (record.attempts >= MAX_ATTEMPTS) {
      await EmailOTP.deleteOne({ _id: record._id });
      throw new Error("Too many incorrect attempts. Request a new OTP");
    }

    await record.save();
    throw new Error("OTP is incorrect");
  }

  record.verified = true;
await record.save();

await EmailOTP.deleteOne({ _id: record._id });

return true;
}

module.exports = { sendOTP, verifyOTP };
