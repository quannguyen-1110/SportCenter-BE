const LearningPath = require("../models/LearningPath");
const Course = require("../models/Course");
const Lesson = require("../models/Lesson");

const createLearningPath = async (req, res) => {
  try {
    const {
      courseId,
      name,
      description,
    } = req.body;

    if (!courseId || !name) {
      return res.status(400).json({
        success: false,
        message: "courseId and name are required",
      });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const learningPath = await LearningPath.create({
      courseId,
      name: name.trim(),
      description: description || "",
    });

    return res.status(201).json({
      success: true,
      message: "Learning path created successfully",
      data: {
        id: learningPath._id,
        courseId: learningPath.courseId,
        name: learningPath.name,
        description: learningPath.description,
        createdAt: learningPath.createdAt,
      },
    });
  } catch (error) {
    console.error("Create learning path error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get all learning paths
const getLearningPaths = async (req, res) => {
  try {
    const learningPaths = await LearningPath.find()
      .populate(
        "courseId",
        "name description status"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Learning paths retrieved successfully",
      data: learningPaths,
    });
  } catch (error) {
    console.error(
      "Get learning paths error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update learning path
const updateLearningPath = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      courseId,
      name,
      description,
    } = req.body;

    if (
      courseId === undefined &&
      name === undefined &&
      description === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one field is required to update",
      });
    }

    const learningPath =
      await LearningPath.findById(id);

    if (!learningPath) {
      return res.status(404).json({
        success: false,
        message: "Learning path not found",
      });
    }

    if (courseId !== undefined) {
      const course = await Course.findById(courseId);

      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      learningPath.courseId = courseId;
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Learning path name cannot be empty",
        });
      }

      learningPath.name = name.trim();
    }

    if (description !== undefined) {
      learningPath.description = description;
    }

    await learningPath.save();

    return res.status(200).json({
      success: true,
      message:
        "Learning path updated successfully",
      data: {
        id: learningPath._id,
        courseId: learningPath.courseId,
        name: learningPath.name,
        description: learningPath.description,
        createdAt: learningPath.createdAt,
        updatedAt: learningPath.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      "Update learning path error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Delete learning path
const deleteLearningPath = async (req, res) => {
  try {
    const { id } = req.params;

    const learningPath =
      await LearningPath.findById(id);

    if (!learningPath) {
      return res.status(404).json({
        success: false,
        message: "Learning path not found",
      });
    }

    const lesson = await Lesson.findOne({
      learningPathId: id,
    });

    if (lesson) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete learning path because it is being used by a lesson",
      });
    }

    await LearningPath.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Learning path deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete learning path error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createLearningPath,
  getLearningPaths,
  updateLearningPath,
  deleteLearningPath,
};