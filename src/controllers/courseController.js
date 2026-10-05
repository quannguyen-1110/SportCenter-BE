const Course = require("../models/Course");
const LearningPath = require("../models/LearningPath");

const createCourse = async (req, res) => {
  try {
    const { name, description, status } = req.body;

    // Validate required field
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "name is required",
      });
    }

    // Create course
    const course = await Course.create({
      name: name.trim(),
      description: description || "",
      status: status || "ACTIVE",
    });

    return res.status(201).json({
      success: true,
      message: "Course created successfully",
      data: {
        id: course._id,
        name: course.name,
        description: course.description,
        status: course.status,
        createdAt: course.createdAt,
      },
    });
  } catch (error) {
    console.error("Create course error:", error);

    // Duplicate course name
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Course name already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get all courses
const getCourses = async (req, res) => {
  try {
    const courses = await Course.find()
      .select("_id name description status createdAt updatedAt")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Courses retrieved successfully",
      data: courses,
    });
  } catch (error) {
    console.error("Get courses error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update course
const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    // Validate request body
    if (
      name === undefined &&
      description === undefined &&
      status === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one field is required to update",
      });
    }

    // Check course
    const course = await Course.findById(id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Update name
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Course name cannot be empty",
        });
      }

      const existingCourse = await Course.findOne({
        name: name.trim(),
        _id: { $ne: id },
      });

      if (existingCourse) {
        return res.status(409).json({
          success: false,
          message: "Course name already exists",
        });
      }

      course.name = name.trim();
    }

    // Update description
    if (description !== undefined) {
      course.description = description;
    }

    // Update status
    if (status !== undefined) {
      if (!["ACTIVE", "INACTIVE"].includes(status)) {
        return res.status(400).json({
          success: false,
          message:
            "status must be ACTIVE or INACTIVE",
        });
      }

      course.status = status;
    }

    await course.save();

    return res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: {
        id: course._id,
        name: course.name,
        description: course.description,
        status: course.status,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update course error:", error);

    // Duplicate course name
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Course name already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Delete course
const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    // Check course
    const course = await Course.findById(id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Check learning paths using this course
    const learningPath = await LearningPath.findOne({
      courseId: id,
    });

    if (learningPath) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete course because it is being used by a learning path",
      });
    }

    // Delete course
    await Course.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("Delete course error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createCourse,
  getCourses,
  updateCourse,
  deleteCourse,
};