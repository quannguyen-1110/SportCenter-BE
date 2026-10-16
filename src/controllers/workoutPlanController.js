const mongoose = require("mongoose");
const WorkoutPlan = require("../models/WorkoutPlan");
const Coach = require("../models/Coach");
const Member = require("../models/Member");
const Class = require("../models/Class");
const ClassRegistration = require("../models/ClassRegistration");

const VALID_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const VALID_SOURCES = ["COACH", "AI"];
const VALID_STATUSES = ["DRAFT", "APPROVED"];

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Lấy hồ sơ Coach từ token đăng nhập.
const getAuthenticatedCoach = async (req, res, requestedCoachId) => {
  if (!req.user || !req.user.userId) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return null;
  }

  const coach = await Coach.findOne({ userId: req.user.userId });

  if (!coach) {
    res.status(404).json({
      success: false,
      message: "Coach profile not found",
    });
    return null;
  }

  // Nếu client gửi coachId, phải trùng với Coach đang đăng nhập.
  if (requestedCoachId !== undefined && requestedCoachId !== null) {
    if (!isValidId(requestedCoachId)) {
      res.status(400).json({
        success: false,
        message: "Invalid coachId",
      });
      return null;
    }

    if (coach._id.toString() !== requestedCoachId.toString()) {
      res.status(403).json({
        success: false,
        message: "You can only manage your own workout plans",
      });
      return null;
    }
  }

  return coach;
};

// Kiểm tra lớp có tồn tại và thuộc Coach đang đăng nhập hay không.
const getAssignedClass = async (classId, coachId, res) => {
  if (!isValidId(classId)) {
    res.status(400).json({
      success: false,
      message: "Invalid classId",
    });
    return null;
  }

  const classData = await Class.findById(classId);

  if (!classData) {
    res.status(404).json({
      success: false,
      message: "Class not found",
    });
    return null;
  }

  if (
    !classData.coachId ||
    classData.coachId.toString() !== coachId.toString()
  ) {
    res.status(403).json({
      success: false,
      message: "You are not assigned to this class",
    });
    return null;
  }

  return classData;
};

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

    // Cho phép tạo kế hoạch cá nhân hoặc kế hoạch chung cho lớp.
    if (
      !goal ||
      typeof goal !== "string" ||
      !goal.trim() ||
      !level ||
      !plan ||
      typeof plan !== "string" ||
      !plan.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "goal, level and plan are required",
      });
    }

    // Phải có memberId hoặc classId.
    if ((!memberId && !classId) || (memberId && classId)) {
  return res.status(400).json({
    success: false,
    message: "Provide either memberId or classId, not both",
  });
    }
    

    if (!VALID_LEVELS.includes(level)) {
      return res.status(400).json({
        success: false,
        message: "level must be BEGINNER, INTERMEDIATE or ADVANCED",
      });
    }

    const planSource = source ?? "COACH";
    const planStatus = status ?? "DRAFT";

    if (!VALID_SOURCES.includes(planSource)) {
      return res.status(400).json({
        success: false,
        message: "source must be COACH or AI",
      });
    }

    if (!VALID_STATUSES.includes(planStatus)) {
      return res.status(400).json({
        success: false,
        message: "status must be DRAFT or APPROVED",
      });
    }

    const coach = await getAuthenticatedCoach(req, res, coachId);
    if (!coach) return;

    // Nếu có memberId, xác nhận học viên tồn tại.
    if (memberId) {
      if (!isValidId(memberId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid memberId",
        });
      }

      const member = await Member.findById(memberId);

      if (!member) {
        return res.status(404).json({
          success: false,
          message: "Member not found",
        });
      }
    }

    // Nếu có classId, Coach phải được phân công vào lớp đó.
    if (classId) {
      const classData = await getAssignedClass(classId, coach._id, res);
      if (!classData) return;
    }

    const workoutPlan = await WorkoutPlan.create({
      coachId: coach._id,
      memberId: memberId || null,
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
      data: workoutPlan,
    });
  } catch (error) {
    console.error("Create workout plan error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET workout plans theo quyền truy cập.
const getWorkoutPlans = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    let filter = {};

    if (req.user.role === "COACH") {
      const coach = await Coach.findOne({ userId: req.user.userId });

      if (!coach) {
        return res.status(404).json({
          success: false,
          message: "Coach profile not found",
        });
      }

      filter = { coachId: coach._id };
    } else if (req.user.role === "MEMBER") {
      const member = await Member.findOne({ userId: req.user.userId });

      if (!member) {
        return res.status(404).json({
          success: false,
          message: "Member profile not found",
        });
      }

      // Lấy các lớp mà học viên đã đăng ký và được xác nhận.
      const registrations = await ClassRegistration.find({
        memberId: member._id,
        status: "CONFIRMED",
      }).select("classId");

      const classIds = registrations.map((item) => item.classId);

      // Học viên thấy kế hoạch cá nhân của mình và kế hoạch chung
      // của những lớp mình đã đăng ký.
      filter = {
        $or: [
          { memberId: member._id },
          {
            memberId: null,
            classId: { $in: classIds },
          },
        ],
      };
    } else if (req.user.role !== "CENTER_MANAGER") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const workoutPlans = await WorkoutPlan.find(filter)
      .populate("coachId", "fullName phone")
      .populate("memberId", "fullName phone goal level")
      .populate("classId", "name subjectId courseId coachId")
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

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workout plan ID",
      });
    }

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
      !goal ||
      typeof goal !== "string" ||
      !goal.trim() ||
      !level ||
      !plan ||
      typeof plan !== "string" ||
      !plan.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "goal, level and plan are required",
      });
    }

    if ((!memberId && !classId) || (memberId && classId)) {
  return res.status(400).json({
    success: false,
    message: "Provide either memberId or classId, not both",
  });
}

    if (!VALID_LEVELS.includes(level)) {
      return res.status(400).json({
        success: false,
        message: "level must be BEGINNER, INTERMEDIATE or ADVANCED",
      });
    }

    const planSource = source ?? "COACH";
    const planStatus = status ?? "DRAFT";

    if (!VALID_SOURCES.includes(planSource)) {
      return res.status(400).json({
        success: false,
        message: "source must be COACH or AI",
      });
    }

    if (!VALID_STATUSES.includes(planStatus)) {
      return res.status(400).json({
        success: false,
        message: "status must be DRAFT or APPROVED",
      });
    }

    const coach = await getAuthenticatedCoach(req, res, coachId);
    if (!coach) return;

    // Chỉ Coach sở hữu kế hoạch mới được sửa.
    const workoutPlan = await WorkoutPlan.findOne({
      _id: id,
      coachId: coach._id,
    });

    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: "Workout plan not found",
      });
    }

    if (memberId) {
      if (!isValidId(memberId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid memberId",
        });
      }

      const member = await Member.findById(memberId);

      if (!member) {
        return res.status(404).json({
          success: false,
          message: "Member not found",
        });
      }
    }

    if (classId) {
      const classData = await getAssignedClass(classId, coach._id, res);
      if (!classData) return;
    }

    workoutPlan.memberId = memberId || null;
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

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workout plan ID",
      });
    }

    const coach = await getAuthenticatedCoach(req, res);
    if (!coach) return;

    // Chỉ Coach sở hữu kế hoạch mới được xóa.
    const workoutPlan = await WorkoutPlan.findOne({
      _id: id,
      coachId: coach._id,
    });

    if (!workoutPlan) {
      return res.status(404).json({
        success: false,
        message: "Workout plan not found",
      });
    }

    await workoutPlan.deleteOne();

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