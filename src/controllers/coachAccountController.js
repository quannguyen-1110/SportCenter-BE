const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Coach = require("../models/Coach");
const { validateSubjectIds } = require("../models/coachSubjects");

// Provision both records together; the authenticated manager never chooses the role.
const createCoachAccount = async (req, res) => {
  try {
    const payload = req.body || {};
    const { email, password, fullName, phone, subjectIds } = payload;
    if (typeof email !== "string" || email.trim().length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, message: "A valid email is required" });
    }
    if (typeof password !== "string" || !password.trim() || password.length < 6 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ success: false, message: "Password must have at least 6 characters and at most 72 UTF-8 bytes" });
    }
    if (typeof fullName !== "string" || !fullName.trim() || typeof phone !== "string" || !phone.trim()) {
      return res.status(400).json({ success: false, message: "fullName and phone are required" });
    }
    if (payload.subjectId !== undefined) {
      return res.status(400).json({ success: false, message: "Use subjectIds as an array containing exactly one subject ID" });
    }
    const qualification = await validateSubjectIds(subjectIds);
    if (!qualification.valid) return res.status(qualification.status).json({ success: false, message: qualification.message });

    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 10);
    const data = await mongoose.connection.transaction(async session => {
      if (await User.findOne({ email: normalizedEmail }).session(session)) {
        const conflict = new Error("Email already exists");
        conflict.code = "EMAIL_EXISTS";
        throw conflict;
      }
      const [user] = await User.create([{
        email: normalizedEmail, passwordHash, role: "COACH", authProvider: "LOCAL", status: "ACTIVE",
      }], { session });
      const [coach] = await Coach.create([{
        userId: user._id, fullName: fullName.trim(), phone: phone.trim(), subjectIds: qualification.subjectIds,
      }], { session });
      // Explicit fields prevent returning passwords, hashes or authentication tokens.
      return {
        user: { id: user._id, email: user.email, role: user.role, status: user.status },
        coach: { id: coach._id, userId: coach.userId, fullName: coach.fullName, phone: coach.phone, subjectIds: coach.subjectIds },
      };
    });
    return res.status(201).json({ success: true, message: "Coach account and profile created successfully", data });
  } catch (error) {
    if (error.code === "EMAIL_EXISTS" || error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: "Invalid coach account data" });
    }
    // Avoid logging account payloads or credentials, including errors containing write documents.
    console.error("Create coach account error:", error.name, error.code);
    return res.status(500).json({ success: false, message: "Could not create coach account. Please check the account list before retrying." });
  }
};

module.exports = { createCoachAccount };
