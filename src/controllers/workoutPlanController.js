const WorkoutPlan = require("../models/WorkoutPlan");
const Coach = require("../models/Coach");
const Member = require("../models/Member");
const Class = require("../models/Class");

const createWorkoutPlan = async (req, res) => {
  try {
    const { coachId, memberId, classId, plan } = req.body;

    if (!coachId || !plan) {
      return res.status(400).json({
        success: false,
        message: "coachId and plan are required",
      });
    }

    const coach = await Coach.findById(coachId);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    if (memberId) {
      const member = await Member.findById(memberId);

      if (!member) {
        return res.status(404).json({
          success: false,
          message: "Member not found",
        });
      }
    }

    if (classId) {
      const classData = await Class.findById(classId);

      if (!classData) {
        return res.status(404).json({
          success: false,
          message: "Class not found",
        });
      }
    }

    const workoutPlan = await WorkoutPlan.create({
      coachId,
      memberId: memberId || null,
      classId: classId || null,
      plan: plan.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Workout plan created successfully",
      data: {
        id: workoutPlan._id,
        coachId: workoutPlan.coachId,
        memberId: workoutPlan.memberId,
        classId: workoutPlan.classId,
        plan: workoutPlan.plan,
        createdAt: workoutPlan.createdAt,
      },
    });
  } catch (error) {
    console.error("Create workout plan error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createWorkoutPlan,
};