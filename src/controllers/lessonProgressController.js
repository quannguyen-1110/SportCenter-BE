const LessonProgress = require("../models/LessonProgress");
const Member = require("../models/Member");
const Lesson = require("../models/Lesson");

// CREATE lesson progress
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

// GET all lesson progress
const getLessonProgress = async (req, res) => {
  try {
    const lessonProgress = await LessonProgress.find()
      .populate(
        "memberId",
        "fullName phone goal level"
      )
      .populate(
        "lessonId",
        "title description order learningPathId"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Lesson progress retrieved successfully",
      data: lessonProgress,
    });
  } catch (error) {
    console.error(
      "Get lesson progress error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// UPDATE lesson progress
const updateLessonProgress = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      memberId,
      lessonId,
      status,
    } = req.body;

    // Validate required fields
    if (!memberId || !lessonId || !status) {
      return res.status(400).json({
        success: false,
        message:
          "memberId, lessonId and status are required",
      });
    }

    // Validate status
    const validStatuses = [
      "NOT_STARTED",
      "IN_PROGRESS",
      "COMPLETED",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "status must be NOT_STARTED, IN_PROGRESS or COMPLETED",
      });
    }

    // Check progress
    const progress =
      await LessonProgress.findById(id);

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: "Lesson progress not found",
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

    // Check duplicate progress
    const existingProgress =
      await LessonProgress.findOne({
        memberId,
        lessonId,
        _id: { $ne: id },
      });

    if (existingProgress) {
      return res.status(409).json({
        success: false,
        message:
          "Lesson progress already exists for this member",
      });
    }

    // Update progress
    progress.memberId = memberId;
    progress.lessonId = lessonId;
    progress.status = status;

    if (status === "COMPLETED") {
      progress.completedAt = new Date();
    } else {
      progress.completedAt = null;
    }

    await progress.save();

    return res.status(200).json({
      success: true,
      message: "Lesson progress updated successfully",
      data: progress,
    });
  } catch (error) {
    console.error(
      "Update lesson progress error:",
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
  getLessonProgress,
  updateLessonProgress,
};