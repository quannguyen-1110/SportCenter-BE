const WorkoutResult = require("../models/WorkoutResult");
const WorkoutPlan = require("../models/WorkoutPlan");
const Member = require("../models/Member");

// CREATE workout result
const createWorkoutResult = async (req, res) => {
  try {
    const {
      workoutPlanId,
      memberId,
      result,
      comment,
    } = req.body;

    if (!workoutPlanId || !memberId || !result) {
      return res.status(400).json({
        success: false,
        message:
          "workoutPlanId, memberId and result are required",
      });
    }

    // Check workout plan
    const workoutPlan = await WorkoutPlan.findById(
      workoutPlanId
    );

    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: "Workout plan not found",
      });
    }

    // Check member
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
    });

    return res.status(201).json({
      success: true,
      message: "Workout result created successfully",
      data: {
        id: workoutResult._id,
        workoutPlanId: workoutResult.workoutPlanId,
        memberId: workoutResult.memberId,
        result: workoutResult.result,
        comment: workoutResult.comment,
        createdAt: workoutResult.createdAt,
      },
    });
  } catch (error) {
    console.error("Create workout result error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET all workout results
const getWorkoutResults = async (req, res) => {
  try {
    const workoutResults = await WorkoutResult.find()
      .populate({
        path: "workoutPlanId",
        select:
          "coachId memberId classId goal level plan source status",
        populate: {
          path: "coachId",
          select: "fullName phone",
        },
      })
      .populate(
        "memberId",
        "fullName phone goal level"
      )
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

// UPDATE workout result
const updateWorkoutResult = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      workoutPlanId,
      memberId,
      result,
      comment,
    } = req.body;

    if (!workoutPlanId || !memberId || !result) {
      return res.status(400).json({
        success: false,
        message:
          "workoutPlanId, memberId and result are required",
      });
    }

    // Check workout result
    const workoutResult =
      await WorkoutResult.findById(id);

    if (!workoutResult) {
      return res.status(404).json({
        success: false,
        message: "Workout result not found",
      });
    }

    // Check workout plan
    const workoutPlan = await WorkoutPlan.findById(
      workoutPlanId
    );

    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: "Workout plan not found",
      });
    }

    // Check member
    const member = await Member.findById(memberId);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    // Update
    workoutResult.workoutPlanId = workoutPlanId;
    workoutResult.memberId = memberId;
    workoutResult.result = result.trim();
    workoutResult.comment = comment
      ? comment.trim()
      : "";

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