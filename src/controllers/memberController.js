const Member = require("../models/Member");
const User = require("../models/User");

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

// GET all members
const getMembers = async (req, res) => {
  try {
    const members = await Member.find()
      .select("_id userId fullName phone goal level createdAt updatedAt")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Members retrieved successfully",
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

module.exports = {
  createMember,
  getMembers,
  updateMember,
  deleteMember,
};