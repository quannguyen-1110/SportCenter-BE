const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Coach = require("../models/Coach");
const Subject = require("../models/Subject");
const Class = require("../models/Class");
const { roles: rolePermissions } = require("../config/permissions");

const STAFF_ROLES = ["CENTER_MANAGER", "COACH", "RECEPTIONIST"];
const ALL_ROLES = [...STAFF_ROLES, "MEMBER"];
const STATUSES = ["ACTIVE", "INACTIVE"];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/staff/roles - what each role may do in the system
const getRoles = (req, res) => res.json({ success: true, data: rolePermissions });

// GET /api/staff/accounts?role=&status=&q=
// Without role, lists staff accounts (manager, coach, receptionist).
const listAccounts = async (req, res) => {
  try {
    const { role, status } = req.query;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (role && !ALL_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }
    if (status && !STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const filter = { role: role || { $in: STAFF_ROLES } };
    if (status) filter.status = status;
    if (q) {
      const pattern = { $regex: escapeRegex(q), $options: "i" };
      filter.$or = [{ email: pattern }, { fullName: pattern }, { phone: pattern }];
    }

    const users = await User.find(filter)
      .select("email fullName phone role status authProvider createdAt")
      .sort({ role: 1, createdAt: -1 })
      .limit(500)
      .lean();

    const coaches = await Coach.find({ userId: { $in: users.map((user) => user._id) } })
      .populate("subjectId", "name")
      .lean();
    const coachByUser = new Map(coaches.map((coach) => [String(coach.userId), coach]));

    return res.json({
      success: true,
      count: users.length,
      data: users.map((user) => ({ ...user, coach: coachByUser.get(String(user._id)) ?? null })),
    });
  } catch (error) {
    console.error("List accounts error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// PATCH /api/staff/accounts/:id  { role?, status?, subjectId? }
// Changes a staff member's role or locks/unlocks any account.
const updateAccountAccess = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, status, subjectId } = req.body ?? {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid account id" });
    }
    if (role === undefined && status === undefined) {
      return res.status(400).json({ success: false, message: "role or status is required" });
    }
    if (role !== undefined && !STAFF_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: "role must be CENTER_MANAGER, COACH or RECEPTIONIST" });
    }
    if (status !== undefined && !STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "status must be ACTIVE or INACTIVE" });
    }
    if (id === req.user.userId) {
      return res.status(409).json({ success: false, message: "You cannot change your own role or status" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    if (role !== undefined && role !== user.role) {
      if (user.role === "MEMBER") {
        return res.status(409).json({ success: false, message: "Member accounts cannot be converted to staff roles" });
      }

      const coachProfile = await Coach.findOne({ userId: user._id });

      if (user.role === "COACH" && coachProfile && await Class.exists({ coachId: coachProfile._id })) {
        return res.status(409).json({
          success: false,
          message: "Reassign this coach's class to another coach before changing the role",
        });
      }

      if (role === "COACH" && !coachProfile) {
        if (!mongoose.isValidObjectId(subjectId) || !await Subject.exists({ _id: subjectId })) {
          return res.status(400).json({ success: false, message: "A valid subjectId is required to become COACH" });
        }
        await Coach.create({
          userId: user._id,
          fullName: user.fullName || user.email,
          phone: user.phone || "N/A",
          subjectId,
        });
      }

      if (user.role === "COACH" && coachProfile) {
        await Coach.deleteOne({ _id: coachProfile._id });
      }

      user.role = role;
    }

    if (status !== undefined) user.status = status;

    await user.save();

    return res.json({
      success: true,
      message: "Account access updated successfully",
      data: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Update account access error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

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
  getRoles,
  listAccounts,
  updateAccountAccess,
};

const publicAccount = user => ({ id: user._id, email: user.email, fullName: user.fullName,
  phone: user.phone, role: user.role, status: user.status, authProvider: user.authProvider, createdAt: user.createdAt });


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
