const Coach = require("../models/Coach");
const User = require("../models/User");
const Class = require("../models/Class");
const ClassRegistration = require("../models/ClassRegistration");
// CREATE coach
const createCoach = async (req, res) => {
  try {
    const { userId, fullName, phone } = req.body;

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

    if (user.role !== "COACH") {
      return res.status(400).json({
        success: false,
        message: "User role must be COACH",
      });
    }

    const existingCoach = await Coach.findOne({ userId });

    if (existingCoach) {
      return res.status(409).json({
        success: false,
        message: "Coach profile already exists",
      });
    }

    const coach = await Coach.create({
      userId,
      fullName: fullName.trim(),
      phone: phone.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Coach created successfully",
      data: {
        id: coach._id,
        userId: coach.userId,
        fullName: coach.fullName,
        phone: coach.phone,
      },
    });
  } catch (error) {
    console.error("Create coach error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET all coaches
const getCoaches = async (req, res) => {
  try {
    const coaches = await Coach.find()
      .select("_id userId fullName phone createdAt updatedAt")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Coaches retrieved successfully",
      data: coaches,
    });
  } catch (error) {
    console.error("Get coaches error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// UPDATE coach
const updateCoach = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phone } = req.body;

    if (!fullName || !phone) {
      return res.status(400).json({
        success: false,
        message: "fullName and phone are required",
      });
    }

    const coach = await Coach.findById(id);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    coach.fullName = fullName.trim();
    coach.phone = phone.trim();

    await coach.save();

    return res.status(200).json({
      success: true,
      message: "Coach updated successfully",
      data: {
        id: coach._id,
        userId: coach.userId,
        fullName: coach.fullName,
        phone: coach.phone,
      },
    });
  } catch (error) {
    console.error("Update coach error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE coach
const deleteCoach = async (req, res) => {
  try {
    const { id } = req.params;

    const coach = await Coach.findById(id);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    await Coach.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Coach deleted successfully",
    });
  } catch (error) {
    console.error("Delete coach error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
// GET students in classes assigned to current coach
const getMyStudents = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;

    // Find current coach profile
    const coach = await Coach.findOne({ userId });

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
    }

    // Find classes assigned to this coach
    const classes = await Class.find({
      coachId: coach._id,
    }).select("_id name");

    const classIds = classes.map((item) => item._id);

    // Find confirmed registrations in those classes
    const registrations = await ClassRegistration.find({
      classId: { $in: classIds },
      status: "CONFIRMED",
    })
      .populate({
        path: "memberId",
        select: "fullName phone userId",
      })
      .populate({
        path: "classId",
        select: "name",
      })
      .sort({ registeredAt: -1 });

    const students = registrations
      .filter((registration) => registration.memberId)
      .map((registration) => ({
        member: registration.memberId,
        class: registration.classId,
        registeredAt: registration.registeredAt,
      }));

    return res.status(200).json({
      success: true,
      message: "My students retrieved successfully",
      data: students,
    });
  } catch (error) {
    console.error("Get my students error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
// GET my coach profile
const getMyCoachProfile = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;

    const coach = await Coach.findOne({ userId })
      .select("_id userId fullName phone createdAt updatedAt");

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Coach profile retrieved successfully",
      data: coach,
    });
  } catch (error) {
    console.error("Get my coach profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createCoach,
  getCoaches,
  updateCoach,
  deleteCoach,
  getMyCoachProfile,
  getMyStudents,
};