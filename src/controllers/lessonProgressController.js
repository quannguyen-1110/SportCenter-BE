
const mongoose = require("mongoose");
const LessonProgress = require("../models/LessonProgress");
const Member = require("../models/Member");
const Lesson = require("../models/Lesson");
const Coach = require("../models/Coach");
const Class = require("../models/Class");
const ClassRegistration = require("../models/ClassRegistration");
const LearningPath = require("../models/LearningPath");

const VALID_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
];

// Check whether a member has confirmed registration
// in a class assigned to the specified coach.
const coachCanAccessProgress = async (coachId, memberId, classId) => {
  const assignedClass = await Class.findOne({
    _id: classId,
    coachId,
  });

  if (!assignedClass) return false;

  const registration = await ClassRegistration.findOne({
    classId,
    memberId,
    status: "CONFIRMED",
  });

  return Boolean(registration);
};

// CREATE lesson progress
const createLessonProgress = async (req, res) => {
  try {
    const { memberId, lessonId, classId, status } = req.body;

    if (!memberId || !lessonId || !classId) {
      return res.status(400).json({
        success: false,
        message: "memberId, lessonId and classId are required",
      });
    }

    if (
      !mongoose.isValidObjectId(memberId) ||
      !mongoose.isValidObjectId(lessonId) ||
      !mongoose.isValidObjectId(classId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid memberId, lessonId or classId",
      });
    }

    const progressStatus = status || "NOT_STARTED";

    if (!VALID_STATUSES.includes(progressStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid progress status",
      });
    }

    const [member, lesson, assignedClass] = await Promise.all([
      Member.findById(memberId),
      Lesson.findById(lessonId),
      Class.findById(classId),
    ]);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    if (!assignedClass) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // The lesson must belong to the course used by this class.
    const learningPath = await LearningPath.findById(
      lesson.learningPathId
    );

    if (
      !learningPath ||
      learningPath.courseId.toString() !== assignedClass.courseId.toString()
    ) {
      return res.status(400).json({
        success: false,
        message: "Lesson does not belong to this class's course",
      });
    }

    if (req.user.role === "MEMBER") {
      const ownMember = await Member.findOne({
        userId: req.user.userId,
      });

      if (!ownMember || ownMember._id.toString() !== memberId) {
        return res.status(403).json({
          success: false,
          message: "You can only create your own lesson progress",
        });
      }

      const registration = await ClassRegistration.findOne({
        classId,
        memberId,
        status: "CONFIRMED",
      });

      if (!registration) {
        return res.status(403).json({
          success: false,
          message: "You must have a confirmed class registration",
        });
      }
    } else if (req.user.role === "COACH") {
      const coach = await Coach.findOne({
        userId: req.user.userId,
      });

      if (!coach) {
        return res.status(404).json({
          success: false,
          message: "Coach profile not found",
        });
      }

      const allowed = await coachCanAccessProgress(
        coach._id,
        memberId,
        classId
      );

      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "You can only manage members in your assigned classes",
        });
      }
    } else if (req.user.role !== "CENTER_MANAGER") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const existingProgress = await LessonProgress.findOne({
      memberId,
      lessonId,
      classId,
    });

    if (existingProgress) {
      return res.status(409).json({
        success: false,
        message: "Lesson progress already exists for this member and class",
      });
    }

    const progress = await LessonProgress.create({
      memberId,
      lessonId,
      classId,
      status: progressStatus,
      completedAt:
        progressStatus === "COMPLETED" ? new Date() : null,
    });

    return res.status(201).json({
      success: true,
      message: "Lesson progress created successfully",
      data: progress,
    });
  } catch (error) {
    console.error("Create lesson progress error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET lesson progress based on role
const getLessonProgress = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "MEMBER") {
      const member = await Member.findOne({
        userId: req.user.userId,
      });

      if (!member) {
        return res.status(404).json({
          success: false,
          message: "Member profile not found",
        });
      }

      filter.memberId = member._id;
    } else if (req.user.role === "COACH") {
      const coach = await Coach.findOne({
        userId: req.user.userId,
      });

      if (!coach) {
        return res.status(404).json({
          success: false,
          message: "Coach profile not found",
        });
      }

      const classes = await Class.find({
        coachId: coach._id,
      }).select("_id");

      filter.classId = {
        $in: classes.map((item) => item._id),
      };
    } else if (req.user.role !== "CENTER_MANAGER") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const progressList = await LessonProgress.find(filter)
      .populate("memberId", "fullName phone goal level")
      .populate("lessonId", "title description order learningPathId")
      .populate("classId", "name courseId coachId")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Lesson progress retrieved successfully",
      data: progressList,
    });
  } catch (error) {
    console.error("Get lesson progress error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// UPDATE lesson progress or coach evaluation
const updateLessonProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { memberId, lessonId, classId, status, coachComment } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lesson progress ID",
      });
    }

    if (
      memberId !== undefined ||
      lessonId !== undefined ||
      classId !== undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "memberId, lessonId and classId cannot be changed",
      });
    }

    const progress = await LessonProgress.findById(id);

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: "Lesson progress not found",
      });
    }

    if (req.user.role === "MEMBER") {
      const member = await Member.findOne({
        userId: req.user.userId,
      });

      if (
        !member ||
        progress.memberId.toString() !== member._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You can only update your own lesson progress",
        });
      }

      if (coachComment !== undefined) {
        return res.status(403).json({
          success: false,
          message: "Members cannot edit coach evaluations",
        });
      }

      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "A valid status is required",
        });
      }

      const registration = await ClassRegistration.findOne({
        classId: progress.classId,
        memberId: progress.memberId,
        status: "CONFIRMED",
      });

      if (!registration) {
        return res.status(403).json({
          success: false,
          message: "Confirmed class registration required",
        });
      }

      progress.status = status;
      progress.completedAt =
        status === "COMPLETED"
          ? progress.completedAt || new Date()
          : null;
    } else if (req.user.role === "COACH") {
      const coach = await Coach.findOne({
        userId: req.user.userId,
      });

      if (!coach) {
        return res.status(404).json({
          success: false,
          message: "Coach profile not found",
        });
      }

      const allowed = await coachCanAccessProgress(
        coach._id,
        progress.memberId,
        progress.classId
      );

      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "You cannot evaluate members outside your assigned classes",
        });
      }

      if (status !== undefined) {
        if (!VALID_STATUSES.includes(status)) {
          return res.status(400).json({
            success: false,
            message: "Invalid progress status",
          });
        }

        progress.status = status;
        progress.completedAt =
          status === "COMPLETED"
            ? progress.completedAt || new Date()
            : null;
      }

      if (coachComment !== undefined) {
        if (typeof coachComment !== "string") {
          return res.status(400).json({
            success: false,
            message: "coachComment must be a string",
          });
        }

        progress.coachComment = coachComment.trim();
        progress.evaluatedAt = new Date();
      }

      if (status === undefined && coachComment === undefined) {
        return res.status(400).json({
          success: false,
          message: "Provide status or coachComment",
        });
      }
    } else if (req.user.role === "CENTER_MANAGER") {
      if (coachComment !== undefined) {
        return res.status(403).json({
          success: false,
          message: "Only coaches can submit coach evaluations",
        });
      }

      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "A valid status is required",
        });
      }

      progress.status = status;
      progress.completedAt =
        status === "COMPLETED"
          ? progress.completedAt || new Date()
          : null;
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    await progress.save();

    return res.status(200).json({
      success: true,
      message: "Lesson progress updated successfully",
      data: progress,
    });
  } catch (error) {
    console.error("Update lesson progress error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createLessonProgress,
  getLessonProgress,
  updateLessonProgress,
};
