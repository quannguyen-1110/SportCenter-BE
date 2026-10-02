const LessonProgress = require("../models/LessonProgress");
const Member = require("../models/Member");
const Lesson = require("../models/Lesson");

const createLessonProgress = async (req, res) => {
  try {
    const {
      memberId,
      lessonId,
      status,
    } = req.body;

    // Validate required fields
    if (!memberId || !lessonId) {
      return res.status(400).json({
        success: false,
        message: "memberId and lessonId are required",
      });
    }

    // Validate status
    const validStatuses = [
      "NOT_STARTED",
      "IN_PROGRESS",
      "COMPLETED",
    ];

    const progressStatus = status || "NOT_STARTED";

    if (!validStatuses.includes(progressStatus)) {
      return res.status(400).json({
        success: false,
        message:
          "status must be NOT_STARTED, IN_PROGRESS or COMPLETED",
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

    // Check lesson
    const lesson = await Lesson.findById(lessonId);

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    // Check existing progress
    const existingProgress =
      await LessonProgress.findOne({
        memberId,
        lessonId,
      });

    if (existingProgress) {
      return res.status(409).json({
        success: false,
        message:
          "Lesson progress already exists for this member",
      });
    }

    // Set completedAt when completed
    const completedAt =
      progressStatus === "COMPLETED"
        ? new Date()
        : null;

    // Create progress
    const progress = await LessonProgress.create({
      memberId,
      lessonId,
      status: progressStatus,
      completedAt,
    });

    return res.status(201).json({
      success: true,
      message: "Lesson progress created successfully",
      data: {
        id: progress._id,
        memberId: progress.memberId,
        lessonId: progress.lessonId,
        status: progress.status,
        completedAt: progress.completedAt,
        createdAt: progress.createdAt,
      },
    });
  } catch (error) {
    console.error(
      "Create lesson progress error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createLessonProgress,
};