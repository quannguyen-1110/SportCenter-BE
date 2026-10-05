const WorkoutPlan = require("../models/WorkoutPlan");
const Coach = require("../models/Coach");
const Member = require("../models/Member");
const Class = require("../models/Class");

// CREATE workout plan
const createWorkoutPlan = async (req, res) => {
  try {
    const {
      coachId,
      memberId,
      classId,
      goal,
      level,
      plan,
      source,
      status,
    } = req.body;

    if (
      !coachId ||
      !memberId ||
      !goal ||
      !level ||
      !plan
    ) {
      return res.status(400).json({
        success: false,
        message:
          "coachId, memberId, goal, level and plan are required",
      });
    }

    // Check coach
    const coach = await Coach.findById(coachId);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
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

    // Check class if provided
    if (classId) {
      const classData = await Class.findById(classId);

      if (!classData) {
        return res.status(404).json({
          success: false,
          message: "Class not found",
        });
      }
    }

    // Validate level
    const validLevels = [
      "BEGINNER",
      "INTERMEDIATE",
      "ADVANCED",
    ];

    if (!validLevels.includes(level)) {
      return res.status(400).json({
        success: false,
        message:
          "level must be BEGINNER, INTERMEDIATE or ADVANCED",
      });
    }

    // Validate source
    const validSources = ["COACH", "AI"];
    const planSource = source || "COACH";

    if (!validSources.includes(planSource)) {
      return res.status(400).json({
        success: false,
        message: "source must be COACH or AI",
      });
    }

    // Validate status
    const validStatuses = ["DRAFT", "APPROVED"];
    const planStatus = status || "DRAFT";

    if (!validStatuses.includes(planStatus)) {
      return res.status(400).json({
        success: false,
        message: "status must be DRAFT or APPROVED",
      });
    }

    const workoutPlan = await WorkoutPlan.create({
      coachId,
      memberId,
      classId: classId || null,
      goal: goal.trim(),
      level,
      plan: plan.trim(),
      source: planSource,
      status: planStatus,
    });

    return res.status(201).json({
      success: true,
      message: "Workout plan created successfully",
      data: {
        id: workoutPlan._id,
        coachId: workoutPlan.coachId,
        memberId: workoutPlan.memberId,
        classId: workoutPlan.classId,
        goal: workoutPlan.goal,
        level: workoutPlan.level,
        plan: workoutPlan.plan,
        source: workoutPlan.source,
        status: workoutPlan.status,
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

// GET all workout plans
const getWorkoutPlans = async (req, res) => {
  try {
    const workoutPlans = await WorkoutPlan.find()
      .populate(
        "coachId",
        "fullName phone"
      )
      .populate(
        "memberId",
        "fullName phone goal level"
      )
      .populate(
        "classId",
        "name subjectId courseId coachId"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Workout plans retrieved successfully",
      data: workoutPlans,
    });
  } catch (error) {
    console.error("Get workout plans error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// UPDATE workout plan
const updateWorkoutPlan = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      coachId,
      memberId,
      classId,
      goal,
      level,
      plan,
      source,
      status,
    } = req.body;

    if (
      !coachId ||
      !memberId ||
      !goal ||
      !level ||
      !plan
    ) {
      return res.status(400).json({
        success: false,
        message:
          "coachId, memberId, goal, level and plan are required",
      });
    }

    // Check workout plan
    const workoutPlan = await WorkoutPlan.findById(id);

    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: "Workout plan not found",
      });
    }

    // Check coach
    const coach = await Coach.findById(coachId);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
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

    // Check class if provided
    if (classId) {
      const classData = await Class.findById(classId);

      if (!classData) {
        return res.status(404).json({
          success: false,
          message: "Class not found",
        });
      }
    }

    // Validate level
    const validLevels = [
      "BEGINNER",
      "INTERMEDIATE",
      "ADVANCED",
    ];

    if (!validLevels.includes(level)) {
      return res.status(400).json({
        success: false,
        message:
          "level must be BEGINNER, INTERMEDIATE or ADVANCED",
      });
    }

    // Validate source
    const validSources = ["COACH", "AI"];
    const planSource = source || "COACH";

    if (!validSources.includes(planSource)) {
      return res.status(400).json({
        success: false,
        message: "source must be COACH or AI",
      });
    }

    // Validate status
    const validStatuses = ["DRAFT", "APPROVED"];
    const planStatus = status || "DRAFT";

    if (!validStatuses.includes(planStatus)) {
      return res.status(400).json({
        success: false,
        message: "status must be DRAFT or APPROVED",
      });
    }

    // Update
    workoutPlan.coachId = coachId;
    workoutPlan.memberId = memberId;
    workoutPlan.classId = classId || null;
    workoutPlan.goal = goal.trim();
    workoutPlan.level = level;
    workoutPlan.plan = plan.trim();
    workoutPlan.source = planSource;
    workoutPlan.status = planStatus;

    await workoutPlan.save();

    return res.status(200).json({
      success: true,
      message: "Workout plan updated successfully",
      data: workoutPlan,
    });
  } catch (error) {
    console.error("Update workout plan error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE workout plan
const deleteWorkoutPlan = async (req, res) => {
  try {
    const { id } = req.params;

    const workoutPlan = await WorkoutPlan.findById(id);

    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: "Workout plan not found",
      });
    }

    await WorkoutPlan.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Workout plan deleted successfully",
    });
  } catch (error) {
    console.error("Delete workout plan error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createWorkoutPlan,
  getWorkoutPlans,
  updateWorkoutPlan,
  deleteWorkoutPlan,
};