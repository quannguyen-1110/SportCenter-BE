const Class = require("../models/Class");
const Subject = require("../models/Subject");
const Coach = require("../models/Coach");
const Course = require("../models/Course");

// CREATE class
const createClass = async (req, res) => {
  try {
    const {
      name,
      subjectId,
      courseId,
      coachId,
    } = req.body;

    if (
      !name ||
      !name.trim() ||
      !subjectId ||
      !courseId ||
      !coachId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "name, subjectId, courseId and coachId are required",
      });
    }

    const subject = await Subject.findById(subjectId);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

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

// GET all classes
const getClasses = async (req, res) => {
  try {
    const classes = await Class.find()
      .populate("subjectId", "name")
      .populate("courseId", "name description status")
      .populate("coachId", "fullName phone")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Classes retrieved successfully",
      data: classes,
    });
  } catch (error) {
    console.error("Get classes error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// UPDATE class
const updateClass = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      subjectId,
      courseId,
      coachId,
    } = req.body;

    if (
      !name ||
      !name.trim() ||
      !subjectId ||
      !courseId ||
      !coachId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "name, subjectId, courseId and coachId are required",
      });
    }

    const existingClass = await Class.findById(id);

    if (!existingClass) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    const subject = await Subject.findById(subjectId);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const coach = await Coach.findById(coachId);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    // Check whether another class is already using this coach
    const classUsingCoach = await Class.findOne({
      coachId,
      _id: { $ne: id },
    });

    if (classUsingCoach) {
      return res.status(409).json({
        success: false,
        message:
          "This coach is already assigned to another class",
      });
    }

    existingClass.name = name.trim();
    existingClass.subjectId = subjectId;
    existingClass.courseId = courseId;
    existingClass.coachId = coachId;

    await existingClass.save();

    return res.status(200).json({
      success: true,
      message: "Class updated successfully",
      data: {
        id: existingClass._id,
        name: existingClass.name,
        subjectId: existingClass.subjectId,
        courseId: existingClass.courseId,
        coachId: existingClass.coachId,
      },
    });
  } catch (error) {
    console.error("Update class error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE class
const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;

    const existingClass = await Class.findById(id);

    if (!existingClass) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    await Class.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Class deleted successfully",
    });
  } catch (error) {
    console.error("Delete class error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createClass,
  getClasses,
  updateClass,
  deleteClass,
};