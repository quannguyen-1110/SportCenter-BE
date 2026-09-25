const WorkoutResult = require("../models/WorkoutResult");
const WorkoutPlan = require("../models/WorkoutPlan");
const Member = require("../models/Member");

const createWorkoutResult = async (req, res) => {
  try {
    const { workoutPlanId, memberId, result, comment } = req.body;

    if (!workoutPlanId || !memberId || !result) {
      return res.status(400).json({
        success: false,
        message: "workoutPlanId, memberId and result are required",
      });
    }

    const workoutPlan = await WorkoutPlan.findById(workoutPlanId);

    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: "Workout plan not found",
      });
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

module.exports = {
  createWorkoutResult,
};