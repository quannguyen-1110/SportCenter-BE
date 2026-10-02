const LearningPath = require("../models/LearningPath");
const Course = require("../models/Course");

const createLearningPath = async (req, res) => {
  try {
    const {
      courseId,
      name,
      description,
    } = req.body;

    // Validate required fields
    if (!courseId || !name) {
      return res.status(400).json({
        success: false,
        message: "courseId and name are required",
      });
    }

    // Check course
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Create learning path
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

module.exports = {
  createLearningPath,
};