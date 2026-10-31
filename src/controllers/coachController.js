
const mongoose = require("mongoose");

const Coach = require("../models/Coach");
const User = require("../models/User");
const Subject = require("../models/Subject");
const Class = require("../models/Class");
const ClassRegistration = require("../models/ClassRegistration");

// CREATE coach
const createCoach = async (req, res) => {
  try {
    const { userId, fullName, phone, subjectId } = req.body;

    // Validate required fields
    if (
      !userId ||
      !fullName ||
      !phone ||
      !subjectId ||
      typeof fullName !== "string" ||
      typeof phone !== "string" ||
      !fullName.trim() ||
      !phone.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "userId, fullName, phone and subjectId are required",
      });
    }

    // Validate ObjectIds
    if (
      !mongoose.isValidObjectId(userId) ||
      !mongoose.isValidObjectId(subjectId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId or subjectId",
      });
    }

    // Check User
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

    // Check Subject
    const subject = await Subject.findById(subjectId);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    // Check existing Coach profile
    const existingCoach = await Coach.findOne({ userId });

    if (existingCoach) {
      return res.status(409).json({
        success: false,
        message: "Coach profile already exists",
      });
    }

    // Create Coach
    const coach = await Coach.create({
      userId,
      fullName: fullName.trim(),
      phone: phone.trim(),
      subjectId,
    });

    await coach.populate("subjectId");

    return res.status(201).json({
      success: true,
      message: "Coach created successfully",
      data: coach,
    });
  } catch (error) {
    console.error("Create coach error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET all coaches or filter by subjectId
const getCoaches = async (req, res) => {
  try {
    const { subjectId } = req.query;
    const filter = {};

    // Filter coaches by Subject
    if (subjectId) {
      if (!mongoose.isValidObjectId(subjectId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid subjectId",
        });
      }

      const subject = await Subject.findById(subjectId);

      if (!subject) {
        return res.status(404).json({
          success: false,
          message: "Subject not found",
        });
      }

      filter.subjectId = subjectId;
    }

    const coaches = await Coach.find(filter)
      .select("_id userId fullName phone subjectId createdAt updatedAt")
      .populate("subjectId")
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
    const { fullName, phone, subjectId } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coach ID",
      });
    }

    // At least one field must be provided
    if (
      fullName === undefined &&
      phone === undefined &&
      subjectId === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required",
      });
    }

    const coach = await Coach.findById(id);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    // Update fullName
    if (fullName !== undefined) {
      if (typeof fullName !== "string" || !fullName.trim()) {
        return res.status(400).json({
          success: false,
          message: "fullName must be a non-empty string",
        });
      }

      coach.fullName = fullName.trim();
    }

    // Update phone
    if (phone !== undefined) {
      if (typeof phone !== "string" || !phone.trim()) {
        return res.status(400).json({
          success: false,
          message: "phone must be a non-empty string",
        });
      }

      coach.phone = phone.trim();
    }

    // Update Subject
    if (subjectId !== undefined) {
      if (!mongoose.isValidObjectId(subjectId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid subjectId",
        });
      }

      const subject = await Subject.findById(subjectId);

      if (!subject) {
        return res.status(404).json({
          success: false,
          message: "Subject not found",
        });
      }

      coach.subjectId = subjectId;
    }

    await coach.save();
    await coach.populate("subjectId");

    return res.status(200).json({
      success: true,
      message: "Coach updated successfully",
      data: coach,
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

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coach ID",
      });
    }

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

    // Find current Coach profile
    const coach = await Coach.findOne({ userId });

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
    }

    // Find classes assigned to this Coach
    const classes = await Class.find({
      coachId: coach._id,
    }).select("_id name");

    const classIds = classes.map((item) => item._id);

    // Find confirmed registrations
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
      .select("_id userId fullName phone subjectId createdAt updatedAt")
      .populate("subjectId");

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
