const Member = require("../models/Member");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

// CREATE member
const createMember = async (req, res) => {
  try {
    const { userId, fullName, phone, goal, level } = req.body;

    if (!userId || !fullName || !phone) {
      return res.status(400).json({
        success: false,
        message: "userId, fullName and phone are required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role !== "MEMBER") {
      return res.status(400).json({
        success: false,
        message: "User role must be MEMBER",
      });
    }

    const existingMember = await Member.findOne({ userId });

    if (existingMember) {
      return res.status(409).json({
        success: false,
        message: "Member profile already exists",
      });
    }

    if (
      level &&
      !["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(level)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid member level",
      });
    }

    const member = await Member.create({
      userId,
      fullName: fullName.trim(),
      phone: phone.trim(),
      goal: goal ? goal.trim() : undefined,
      level: level || "BEGINNER",
    });

    return res.status(201).json({
      success: true,
      message: "Member created successfully",
      data: {
        id: member._id,
        userId: member.userId,
        fullName: member.fullName,
        phone: member.phone,
        goal: member.goal,
        level: member.level,
      },
    });
  } catch (error) {
    console.error("Create member error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
// GET ALL MEMBERS / SEARCH MEMBERS
// GET and search members by name or phone
const getMembers = async (req, res) => {
  try {
    const rawQuery =
      typeof req.query.q === "string"
        ? req.query.q.trim()
        : "";

    const filter = {};

    if (rawQuery) {
      // Escape regex special characters to search literal text.
      const escapedQuery = rawQuery.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      filter.$or = [
        {
          fullName: {
            $regex: escapedQuery,
            $options: "i",
          },
        },
        {
          phone: {
            $regex: escapedQuery,
          },
        },
      ];
    }

    const members = await Member.find(filter)
      .select(
        "_id userId fullName phone goal level createdAt updatedAt"
      )
      .sort({ createdAt: -1 })
      .limit(100);

    return res.status(200).json({
      success: true,
      message: rawQuery
        ? "Members searched successfully"
        : "Members retrieved successfully",
      data: members,
    });
  } catch (error) {
    console.error("Get members error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
// UPDATE member
const updateMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phone, goal, level } = req.body;

    if (!fullName || !phone) {
      return res.status(400).json({
        success: false,
        message: "fullName and phone are required",
      });
    }

    if (
      level &&
      !["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(level)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid member level",
      });
    }

    const member = await Member.findById(id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    member.fullName = fullName.trim();
    member.phone = phone.trim();
    member.goal = goal ? goal.trim() : undefined;
    member.level = level || member.level;

    await member.save();

    return res.status(200).json({
      success: true,
      message: "Member updated successfully",
      data: {
        id: member._id,
        userId: member.userId,
        fullName: member.fullName,
        phone: member.phone,
        goal: member.goal,
        level: member.level,
      },
    });
  } catch (error) {
    console.error("Update member error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE member
const deleteMember = async (req, res) => {
  try {
    const { id } = req.params;

    const member = await Member.findById(id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    await Member.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Member deleted successfully",
    });
  } catch (error) {
    console.error("Delete member error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


 // GET my profile
const getMyProfile = async (req, res) => {
  try {
    const member = await Member.findOne({
      userId: req.user.userId,
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member profile not found. Please create your profile.",
      });
    }

    return res.status(200).json({
      success: true,
      data: member,
    });
  } catch (error) {
    console.error("Get my profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// CREATE my profile
const createMyProfile = async (req, res) => {
  try {
    const { fullName, phone, goal, level } = req.body;

    if (!fullName?.trim() || !phone?.trim() || !goal?.trim()) {
      return res.status(400).json({
        success: false,
        message: "fullName, phone and goal are required",
      });
    }

    const user = await User.findById(req.user.userId);

    if (!user || user.role !== "MEMBER") {
      return res.status(403).json({
        success: false,
        message: "Only members can create their own profile",
      });
    }

    const existingMember = await Member.findOne({
      userId: req.user.userId,
    });

    if (existingMember) {
      return res.status(409).json({
        success: false,
        message: "Member profile already exists",
      });
    }

    const validLevels = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];

    if (level && !validLevels.includes(level)) {
      return res.status(400).json({
        success: false,
        message: "Invalid member level",
      });
    }

    const member = await Member.create({
      userId: user._id,
      fullName: fullName.trim(),
      phone: phone.trim(),
      goal: goal.trim(),
      level: level || "BEGINNER",
    });

    return res.status(201).json({
      success: true,
      message: "Member profile created successfully",
      data: member,
    });
  } catch (error) {
    console.error("Create my profile error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Member profile already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// UPDATE my profile
const updateMyProfile = async (req, res) => {
  try {
    const { fullName, phone, goal, level } = req.body;

    if (
      fullName !== undefined &&
      (typeof fullName !== "string" || !fullName.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "fullName must not be empty",
      });
    }

    if (
      phone !== undefined &&
      (typeof phone !== "string" || !phone.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "phone must not be empty",
      });
    }

    if (
      goal !== undefined &&
      (typeof goal !== "string" || !goal.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "goal must not be empty",
      });
    }

    const validLevels = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];

    if (level !== undefined && !validLevels.includes(level)) {
      return res.status(400).json({
        success: false,
        message: "Invalid member level",
      });
    }

    const member = await Member.findOne({
      userId: req.user.userId,
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member profile not found. Please create your profile first.",
      });
    }

    if (fullName !== undefined) member.fullName = fullName.trim();
    if (phone !== undefined) member.phone = phone.trim();
    if (goal !== undefined) member.goal = goal.trim();
    if (level !== undefined) member.level = level;

    await member.save();

    return res.status(200).json({
      success: true,
      message: "Member profile updated successfully",
      data: member,
    });
  } catch (error) {
    console.error("Update my profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// CREATE MEMBER ACCOUNT AT FRONT DESK
const createMemberAtFrontDesk = async (req, res) => {
  let createdUser = null;

  try {
    const { email, password, fullName, phone, goal, level } = req.body;

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password ||
      typeof fullName !== "string" ||
      !fullName.trim() ||
      typeof phone !== "string" ||
      !phone.trim() ||
      typeof goal !== "string" ||
      !goal.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "email, password, fullName, phone and goal are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();
    const memberLevel = level || "BEGINNER";

    if (!["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(memberLevel)) {
      return res.status(400).json({
        success: false,
        message: "Invalid member level",
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create account with a fixed MEMBER role.
    createdUser = await User.create({
      email: normalizedEmail,
      passwordHash,
      authProvider: "LOCAL",
      role: "MEMBER",
      status: "ACTIVE",
    });

    // Create the profile linked to the new account.
    const member = await Member.create({
      userId: createdUser._id,
      fullName: fullName.trim(),
      phone: normalizedPhone,
      goal: goal.trim(),
      level: memberLevel,
    });

    return res.status(201).json({
      success: true,
      message: "Member account and profile created successfully",
      data: {
        user: {
          id: createdUser._id,
          email: createdUser.email,
          role: createdUser.role,
          status: createdUser.status,
        },
        member: {
          id: member._id,
          userId: member.userId,
          fullName: member.fullName,
          phone: member.phone,
          goal: member.goal,
          level: member.level,
        },
      },
    });
  } catch (error) {
    console.error("Create member at front desk error:", error);

    // Remove the newly created account if profile creation failed.
    if (createdUser) {
      try {
        await User.deleteOne({ _id: createdUser._id });
      } catch (cleanupError) {
        console.error("Member account cleanup error:", cleanupError);
      }
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email or another unique field already exists",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createMember,
  getMembers,
  updateMember,
  deleteMember,
  getMyProfile,
  createMyProfile,
  updateMyProfile,
  createMemberAtFrontDesk,
};