
const mongoose = require("mongoose");

const Coach = require("../models/Coach");
const { hasDeletionDependencies } = require("../services/deletionDependencies");
const User = require("../models/User");
const Subject = require("../models/Subject");
const Class = require("../models/Class");
const ClassRegistration = require("../models/ClassRegistration");
const { validateSubjectIds, coachCanTeach } = require("../models/coachSubjects");
// CREATE coach
const createCoach = async (req, res) => {
  try {
    const { userId, fullName, phone, subjectIds } = req.body;

    if (typeof userId !== "string" || !mongoose.isValidObjectId(userId) ||
        typeof fullName !== "string" || !fullName.trim() || typeof phone !== "string" || !phone.trim()) {
      return res.status(400).json({
        success: false,
        message: "Valid userId, fullName, phone and subjectIds are required",
      });
    }

    if (req.body.subjectId !== undefined) return res.status(400).json({ success: false, message: "Use subjectIds as an array containing exactly one subject ID" });
    const qualification = await validateSubjectIds(subjectIds);
    if (!qualification.valid) return res.status(qualification.status).json({ success: false, message: qualification.message });

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
      subjectIds: qualification.subjectIds,
    });


    return res.status(201).json({
      success: true,
      message: "Coach created successfully",
      data: {
        id: coach._id,
        userId: coach.userId,
        fullName: coach.fullName,
        phone: coach.phone,
        subjectIds: coach.subjectIds,
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

// GET all coaches or filter by subjectId
const getCoaches = async (req, res) => {
  try {
    const { subjectId } = req.query;
    const filter = {};

    if (subjectId !== undefined) {
      if (typeof subjectId !== "string" || !mongoose.isValidObjectId(subjectId)) {
        return res.status(400).json({ success: false, message: "Invalid subjectId" });
      }
      if (!await Subject.findById(subjectId)) {
        return res.status(404).json({ success: false, message: "Subject not found" });
      }
      filter.subjectIds = subjectId;
    }

    const coaches = await Coach.find(filter)
      .select("_id userId fullName phone subjectIds createdAt updatedAt")
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
    const { fullName, phone, subjectIds } = req.body;

    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid coach ID" });
    if (req.body.subjectId !== undefined) return res.status(400).json({ success: false, message: "Use subjectIds as an array containing exactly one subject ID" });
    if (fullName === undefined && phone === undefined && subjectIds === undefined) {
      return res.status(400).json({
        success: false,
        message: "At least one of fullName, phone or subjectIds is required",
      });
    }
    if ((fullName !== undefined && (typeof fullName !== "string" || !fullName.trim())) ||
        (phone !== undefined && (typeof phone !== "string" || !phone.trim()))) {
      return res.status(400).json({ success: false, message: "fullName and phone must be non-empty strings" });
    }

    const coach = await Coach.findById(id);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    const qualification = await validateSubjectIds(subjectIds !== undefined ? subjectIds : coach.subjectIds?.map(String));
    if (!qualification.valid) return res.status(qualification.status).json({ success: false, message: qualification.message });
    const assignedClasses = await Class.find({ coachId: coach._id }).select("subjectId");
    if (assignedClasses.some(cls => !coachCanTeach(qualification, cls.subjectId))) {
      return res.status(409).json({ success: false, message: "Cannot change specialty while assigned to a class of another subject" });
    }
    coach.subjectIds = qualification.subjectIds;
    if (fullName !== undefined) coach.fullName = fullName.trim();
    if (phone !== undefined) coach.phone = phone.trim();

    await coach.save();

    return res.status(200).json({
      success: true,
      message: "Coach updated successfully",
      data: {
        id: coach._id,
        userId: coach.userId,
        fullName: coach.fullName,
        phone: coach.phone,
        subjectIds: coach.subjectIds,
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

    if (await hasDeletionDependencies("coach", coach)) {
      return res.status(409).json({ success: false, message: "Cannot delete coach because related records exist" });
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
      .select("_id userId fullName phone subjectIds createdAt updatedAt");

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
// UPDATE my coach profile
const updateMyCoachProfile = async (req, res) => {
  let session;

  try {
    const userId = req.user.userId || req.user._id;
    const body = req.body || {};

    // Only allow fullName and phone
    const allowedFields = ["fullName", "phone"];

    const invalidFields = Object.keys(body).filter(
      (field) => !allowedFields.includes(field)
    );

    if (invalidFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `You cannot update: ${invalidFields.join(", ")}`,
      });
    }

    const updates = {};

    if (body.fullName !== undefined) {
      if (
        typeof body.fullName !== "string" ||
        !body.fullName.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "fullName must be a non-empty string",
        });
      }

      updates.fullName = body.fullName.trim();
    }

    if (body.phone !== undefined) {
      if (
        typeof body.phone !== "string" ||
        !body.phone.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "phone must be a non-empty string",
        });
      }

      updates.phone = body.phone.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide fullName or phone",
      });
    }

    session = await mongoose.startSession();

    let updatedCoachId;

    await session.withTransaction(async () => {
      const user = await User.findById(userId).session(session);

      if (!user) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
      }

      if (user.role !== "COACH") {
        const error = new Error("Only COACH can update this profile");
        error.statusCode = 403;
        throw error;
      }

      if (user.status !== "ACTIVE") {
        const error = new Error("Account is inactive");
        error.statusCode = 403;
        throw error;
      }

      const coach = await Coach.findOne({ userId }).session(session);

      if (!coach) {
        const error = new Error("Coach profile not found");
        error.statusCode = 404;
        throw error;
      }

      // Update User collection
      Object.assign(user, updates);
      await user.save({ session });

      // Update Coach collection
      Object.assign(coach, updates);
      await coach.save({ session });

      updatedCoachId = coach._id;
    });

    const updatedCoach = await Coach.findById(updatedCoachId)
      .select("_id userId fullName phone subjectId createdAt updatedAt")
      .populate("subjectId");

    return res.status(200).json({
      success: true,
      message: "Your coach profile has been updated successfully",
      data: updatedCoach,
    });
  } catch (error) {
    console.error("Update my coach profile error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};
module.exports = {
  createCoach,
  getCoaches,
  updateCoach,
  deleteCoach,
  getMyCoachProfile,
  getMyStudents,
  updateMyCoachProfile,
};
