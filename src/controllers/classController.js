const Class = require("../models/Class");
const Subject = require("../models/Subject");
const Coach = require("../models/Coach");
const Course = require("../models/Course");

const createClass = async (req, res) => {
  try {
    const {
      name,
      subjectId,
      courseId,
      coachId,
    } = req.body;

    // Validate required fields
    if (!name || !subjectId || !courseId || !coachId) {
      return res.status(400).json({
        success: false,
        message:
          "name, subjectId, courseId and coachId are required",
      });
    }

    // Check subject
    const subject = await Subject.findById(subjectId);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
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

    // Check coach
    const coach = await Coach.findById(coachId);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    // One coach can only teach one class
    const existingClass = await Class.findOne({
      coachId,
    });

    if (existingClass) {
      return res.status(409).json({
        success: false,
        message:
          "This coach is already assigned to another class",
      });
    }

    // Create class
    const newClass = await Class.create({
      name: name.trim(),
      subjectId,
      courseId,
      coachId,
    });

    return res.status(201).json({
      success: true,
      message: "Class created successfully",
      data: {
        id: newClass._id,
        name: newClass.name,
        subjectId: newClass.subjectId,
        courseId: newClass.courseId,
        coachId: newClass.coachId,
      },
    });
  } catch (error) {
    console.error("Create class error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createClass,
};