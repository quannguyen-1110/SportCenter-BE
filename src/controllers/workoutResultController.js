const WorkoutResult = require("../models/WorkoutResult");
const WorkoutPlan = require("../models/WorkoutPlan");
const Member = require("../models/Member");
const Coach = require("../models/Coach");
const mongoose = require("mongoose");
const Schedule = require("../models/Schedule");
const { coachCanAccessMember, coachTrainingScope } = require("../services/coachAccess");

const getCoachForUser = async (userId) => {
  return Coach.findOne({ userId });
};

// CREATE workout result — Coach only
const createWorkoutResult = async (req, res) => {
  try {
    const { workoutPlanId, memberId, result, comment, scheduleId } = req.body;

    if (!mongoose.isValidObjectId(workoutPlanId) || !mongoose.isValidObjectId(memberId) ||
        typeof result !== "string" || !result.trim() || (comment !== undefined && typeof comment !== "string") ||
        (scheduleId !== undefined && scheduleId !== null && !mongoose.isValidObjectId(scheduleId))) {
      return res.status(400).json({
        success: false,
        message: "workoutPlanId, memberId and result are required",
      });
    }

    const coach = await getCoachForUser(req.user.userId);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
    }

    const workoutPlan = await WorkoutPlan.findById(workoutPlanId);

    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: "Workout plan not found",
      });
    }

    if (workoutPlan.coachId.toString() !== coach._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this workout plan",
      });
    }

    if (workoutPlan.memberId && workoutPlan.memberId.toString() !== memberId) {
      return res.status(400).json({
        success: false,
        message: "Member does not match the workout plan",
      });
    }
    if (!await coachCanAccessMember(coach._id, memberId, workoutPlan.classId)) {
      return res.status(403).json({ success: false, message: "Member is not confirmed in your assigned class" });
    }
    let resultClassId = workoutPlan.classId;
    if (scheduleId) {
      const schedule = await Schedule.findById(scheduleId);
      if (!schedule || schedule.status === "CANCELLED" ||
          (resultClassId && String(schedule.classId) !== String(resultClassId)) ||
          !await coachCanAccessMember(coach._id, memberId, schedule.classId)) {
        return res.status(400).json({ success: false, message: "Session, member and training plan must belong to your assigned class" });
      }
      resultClassId = schedule.classId;
    }

    const member = await Member.findById(memberId);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    const workoutResult = await WorkoutResult.create({
      workoutPlanId,
      memberId,
      result: result.trim(),
      comment: comment ? comment.trim() : "",
      scheduleId: scheduleId || null,
      classId: resultClassId || null,
    });

    return res.status(201).json({
      success: true,
      message: "Workout result created successfully",
      data: workoutResult,
    });
  } catch (error) {
    console.error("Create workout result error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET workout results based on role
const getWorkoutResults = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "MEMBER") {
      const member = await Member.findOne({ userId: req.user.userId });

      if (!member) {
        return res.status(404).json({
          success: false,
          message: "Member profile not found",
        });
      }

      filter.memberId = member._id;
    } else if (req.user.role === "COACH") {
      const coach = await getCoachForUser(req.user.userId);

      if (!coach) {
        return res.status(404).json({
          success: false,
          message: "Coach profile not found",
        });
      }

      const plans = await WorkoutPlan.find({ coachId: coach._id, ...await coachTrainingScope(coach._id) }).select("_id");
      filter.workoutPlanId = { $in: plans.map((plan) => plan._id) };
    } else if (req.user.role !== "CENTER_MANAGER") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const workoutResults = await WorkoutResult.find(filter)
      .populate({
        path: "workoutPlanId",
        select: "coachId memberId classId goal level plan source status",
        populate: {
          path: "coachId",
          select: "fullName phone",
        },
      })
      .populate("memberId", "fullName phone goal level")
      .populate("scheduleId", "date startTime endTime lessonId classId")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Workout results retrieved successfully",
      data: workoutResults,
    });
  } catch (error) {
    console.error("Get workout results error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// UPDATE workout result — Coach only
const updateWorkoutResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { result, comment } = req.body;

    if (!mongoose.isValidObjectId(id) || typeof result !== "string" || !result.trim() ||
        (comment !== undefined && typeof comment !== "string") ||
        ["memberId", "workoutPlanId", "scheduleId", "classId"].some(key => req.body[key] !== undefined)) {
      return res.status(400).json({
        success: false,
        message: "result is required",
      });
    }

    const coach = await getCoachForUser(req.user.userId);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
    }

    const workoutResult = await WorkoutResult.findById(id);

    if (!workoutResult) {
      return res.status(404).json({
        success: false,
        message: "Workout result not found",
      });
    }

    const workoutPlan = await WorkoutPlan.findById(
      workoutResult.workoutPlanId
    );

    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: "Workout plan not found",
      });
    }

    if (workoutPlan.coachId.toString() !== coach._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this workout plan",
      });
    }

    if (!await coachCanAccessMember(coach._id, workoutResult.memberId, workoutResult.classId || workoutPlan.classId)) {
      return res.status(403).json({ success: false, message: "Member is no longer confirmed in your assigned class" });
    }
    workoutResult.result = result.trim();
    workoutResult.comment = comment ? comment.trim() : "";

    await workoutResult.save();

    return res.status(200).json({
      success: true,
      message: "Workout result updated successfully",
      data: workoutResult,
    });
  } catch (error) {
    console.error("Update workout result error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createWorkoutResult,
  getWorkoutResults,
  updateWorkoutResult,
};
