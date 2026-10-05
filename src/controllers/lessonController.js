const Lesson = require("../models/Lesson");
const LearningPath = require("../models/LearningPath");
const Schedule = require("../models/Schedule");

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
        message:
          "order must be greater than or equal to 1",
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

// Get all lessons
const getLessons = async (req, res) => {
  try {
    const lessons = await Lesson.find()
      .populate({
        path: "learningPathId",
        select: "name description courseId",
        populate: {
          path: "courseId",
          select: "name description status",
        },
      })
      .sort({
        learningPathId: 1,
        order: 1,
      });

    return res.status(200).json({
      success: true,
      message: "Lessons retrieved successfully",
      data: lessons,
    });
  } catch (error) {
    console.error("Get lessons error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update lesson
const updateLesson = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      learningPathId,
      title,
      description,
      order,
    } = req.body;

    // Validate request body
    if (
      learningPathId === undefined &&
      title === undefined &&
      description === undefined &&
      order === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one field is required to update",
      });
    }

    // Check lesson
    const lesson = await Lesson.findById(id);

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    // Determine final values
    const finalLearningPathId =
      learningPathId !== undefined
        ? learningPathId
        : lesson.learningPathId;

    const finalOrder =
      order !== undefined
        ? order
        : lesson.order;

    // Validate order
    if (order !== undefined && order < 1) {
      return res.status(400).json({
        success: false,
        message:
          "order must be greater than or equal to 1",
      });
    }

    // Check learning path
    if (learningPathId !== undefined) {
      const learningPath =
        await LearningPath.findById(
          learningPathId
        );

      if (!learningPath) {
        return res.status(404).json({
          success: false,
          message: "Learning path not found",
        });
      }
    }

    // Check duplicate lesson order
    if (
      learningPathId !== undefined ||
      order !== undefined
    ) {
      const existingLesson =
        await Lesson.findOne({
          learningPathId: finalLearningPathId,
          order: finalOrder,
          _id: { $ne: id },
        });

      if (existingLesson) {
        return res.status(409).json({
          success: false,
          message:
            "A lesson with this order already exists in this learning path",
        });
      }
    }

    // Update learning path
    if (learningPathId !== undefined) {
      lesson.learningPathId =
        learningPathId;
    }

    // Update title
    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Lesson title cannot be empty",
        });
      }

      lesson.title = title.trim();
    }

    // Update description
    if (description !== undefined) {
      lesson.description = description;
    }

    // Update order
    if (order !== undefined) {
      lesson.order = order;
    }

    await lesson.save();

    return res.status(200).json({
      success: true,
      message: "Lesson updated successfully",
      data: {
        id: lesson._id,
        learningPathId:
          lesson.learningPathId,
        title: lesson.title,
        description: lesson.description,
        order: lesson.order,
        createdAt: lesson.createdAt,
        updatedAt: lesson.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update lesson error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Delete lesson
const deleteLesson = async (req, res) => {
  try {
    const { id } = req.params;

    // Check lesson
    const lesson = await Lesson.findById(id);

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    // Check if lesson is being used by a schedule
    const schedule = await Schedule.findOne({
      lessonId: id,
    });

    if (schedule) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete lesson because it is being used by a schedule",
      });
    }

    // Delete lesson
    await Lesson.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Lesson deleted successfully",
    });
  } catch (error) {
    console.error("Delete lesson error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createLesson,
  getLessons,
  updateLesson,
  deleteLesson,
};