const Course = require("../models/Course");

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

module.exports = {
  createCourse,
};