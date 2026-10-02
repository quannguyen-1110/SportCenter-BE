const Lesson = require("../models/Lesson");
const LearningPath = require("../models/LearningPath");

const createLesson = async (req, res) => {
  try {
    const {
      learningPathId,
      title,
      description,
      order,
    } = req.body;

    // Validate required fields
    if (
      !learningPathId ||
      !title ||
      order === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "learningPathId, title and order are required",
      });
    }

    // Validate order
    if (order < 1) {
      return res.status(400).json({
        success: false,
        message: "order must be greater than or equal to 1",
      });
    }

    // Check learning path
    const learningPath =
      await LearningPath.findById(learningPathId);

    if (!learningPath) {
      return res.status(404).json({
        success: false,
        message: "Learning path not found",
      });
    }

    // Check duplicate lesson order
    const existingLesson = await Lesson.findOne({
      learningPathId,
      order,
    });

    if (existingLesson) {
      return res.status(409).json({
        success: false,
        message:
          "A lesson with this order already exists in this learning path",
      });
    }

    // Create lesson
    const lesson = await Lesson.create({
      learningPathId,
      title: title.trim(),
      description: description || "",
      order,
    });

    return res.status(201).json({
      success: true,
      message: "Lesson created successfully",
      data: {
        id: lesson._id,
        learningPathId: lesson.learningPathId,
        title: lesson.title,
        description: lesson.description,
        order: lesson.order,
        createdAt: lesson.createdAt,
      },
    });
  } catch (error) {
    console.error("Create lesson error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createLesson,
};