
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE !== "false",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendGoogleLoginOTP(email, otp) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP_USER or SMTP_PASS is not configured");
  }

  await transporter.sendMail({
    from: `"Sport Center" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Mã xác minh đăng nhập Sport Center",
    text: `Mã OTP của bạn là ${otp}. Mã có hiệu lực trong 5 phút. Không chia sẻ mã này với bất kỳ ai.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
        <h2>Sport Center</h2>
        <p>Bạn đang xác minh đăng nhập Google vào tài khoản Sport Center.</p>
        <p>Mã OTP của bạn:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px;">
          ${otp}
        </div>
        <p>Mã có hiệu lực trong <strong>5 phút</strong>.</p>
        <p>Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>
      </div>
    `,
  });
}

module.exports = { sendGoogleLoginOTP };
