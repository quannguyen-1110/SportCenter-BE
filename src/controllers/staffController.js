const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Coach = require("../models/Coach");
const Subject = require("../models/Subject");

// CENTER_MANAGER creates COACH or RECEPTIONIST accounts
const createStaffAccount = async (req, res) => {
  let createdUserId = null;

  try {
    const {
      email,
      password,
      role,
      fullName,
      phone,
      subjectId,
    } = req.body;

    // Validate role
    if (!["COACH", "RECEPTIONIST"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be COACH or RECEPTIONIST",
      });
    }

    // Validate required fields
    if ([email, password, fullName, phone].some(value => typeof value !== "string" || !value.trim())) {
      return res.status(400).json({
        success: false,
        message: "Email, password, fullName and phone are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = fullName.trim();
    const normalizedPhone = phone.trim();

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Keep the same minimum password length as public registration
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    if (!normalizedName || !normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: "Full name and phone cannot be empty",
      });
    }

    // COACH must have a valid subject
    let subject = null;

    if (role === "COACH") {
      if (!subjectId || !mongoose.Types.ObjectId.isValid(subjectId)) {
        return res.status(400).json({
          success: false,
          message: "A valid subjectId is required for COACH",
        });
      }

      subject = await Subject.findById(subjectId);

      if (!subject) {
        return res.status(404).json({
          success: false,
          message: "Subject not found",
        });
      }
    }

    // Check duplicate email
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered",
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create User account
    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      authProvider: "LOCAL",
      role,
      fullName: normalizedName,
      phone: normalizedPhone,
      status: "ACTIVE",
    });

    createdUserId = user._id;

    let coachProfile = null;

    // Create Coach profile if role is COACH
    if (role === "COACH") {
      coachProfile = await Coach.create({
        userId: user._id,
        fullName: normalizedName,
        phone: normalizedPhone,
        subjectIds: [subject._id],
      });

      await coachProfile.populate("subjectIds");
    }

    return res.status(201).json({
      success: true,
      message: `${role} account created successfully`,
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          role: user.role,
          status: user.status,
        },
        coach: coachProfile,
      },
    });
  } catch (error) {
    console.error("Create staff account error:", error);

    // Roll back created data if Coach profile creation fails
    if (createdUserId) {
      try {
        await Coach.deleteOne({ userId: createdUserId });
        await User.deleteOne({ _id: createdUserId });
      } catch (cleanupError) {
        console.error("Staff account cleanup error:", cleanupError);
      }
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email or staff profile already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create staff account",
      error: error.message,
    });
  }
};

module.exports = {
  createStaffAccount,
};

const publicAccount = user => ({ id: user._id, email: user.email, fullName: user.fullName,
  phone: user.phone, role: user.role, status: user.status, authProvider: user.authProvider, createdAt: user.createdAt });

module.exports.getStaffAccounts = async (req, res) => {
  try {
    const users = await User.find().select("email fullName phone role status authProvider createdAt").sort({ createdAt: -1 });
    return res.json({ success: true, data: users.map(publicAccount) });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not load accounts" }); }
};

module.exports.updateStaffAccount = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid account ID" });
    const { status, fullName, phone, role } = req.body || {};
    if (role !== undefined) return res.status(400).json({ success: false, message: "Account roles cannot be changed through this endpoint" });
    if (status === undefined && fullName === undefined && phone === undefined) return res.status(400).json({ success: false, message: "Provide account details or status" });
    if ((status !== undefined && !["ACTIVE", "INACTIVE"].includes(status)) ||
        [fullName, phone].some(value => value !== undefined && (typeof value !== "string" || !value.trim()))) {
      return res.status(400).json({ success: false, message: "Invalid account details or status" });
    }
    const result = await mongoose.connection.transaction(async session => {
      const user = await User.findById(req.params.id).session(session);
      if (!user) throw Object.assign(new Error("Account not found"), { status: 404 });
      if (user.role === "CENTER_MANAGER") throw Object.assign(new Error("Manager accounts cannot be modified here"), { status: 403 });
      if (status !== undefined) user.status = status;
      if (fullName !== undefined) user.fullName = fullName.trim();
      if (phone !== undefined) user.phone = phone.trim();
      await user.save({ session });
      const updates = { ...(fullName !== undefined ? { fullName: user.fullName } : {}), ...(phone !== undefined ? { phone: user.phone } : {}) };
      if (Object.keys(updates).length) {
        const Profile = user.role === "COACH" ? Coach : require("../models/Member");
        if (["COACH", "MEMBER"].includes(user.role)) await Profile.updateOne({ userId: user._id }, { $set: updates }, { session });
      }
      return publicAccount(user);
    });
    return res.json({ success: true, data: result });
  } catch (error) { return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Could not update account" }); }
};
