
const mongoose = require("mongoose");

const Class = require("../models/Class");
const Subject = require("../models/Subject");
const Coach = require("../models/Coach");
const Course = require("../models/Course");
const Lesson = require("../models/Lesson");
const Schedule = require("../models/Schedule");
const ClassRegistration = require("../models/ClassRegistration");
const Attendance = require("../models/Attendance");
const Homework = require("../models/Homework");

// ==========================================
// CREATE CLASS
// POST /api/classes
// ==========================================
const createClass = async (req, res) => {
  try {
    const { name, courseId, coachId, subjectId } = req.body;

    // Validate required fields
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "name is required",
      });
    }

    if (
      !mongoose.isValidObjectId(courseId) ||
      !mongoose.isValidObjectId(coachId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid courseId and coachId are required",
      });
    }

    // subjectId is optional for backward compatibility.
    // If supplied, it must match the subject of the selected course.
    if (
      subjectId !== undefined &&
      !mongoose.isValidObjectId(subjectId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid subjectId",
      });
    }

    // Find course
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // The course must be linked to an existing subject.
    if (!course.subjectId) {
      return res.status(409).json({
        success: false,
        message:
          "This course has no subject assigned. Update the course first.",
      });
    }

    const subject = await Subject.findById(course.subjectId);

    if (!subject) {
      return res.status(409).json({
        success: false,
        message:
          "The subject linked to this course does not exist. Please fix the course first.",
      });
    }

    // Reject a mismatched subjectId sent by the frontend.
    if (
      subjectId !== undefined &&
      subjectId.toString() !== course.subjectId.toString()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "subjectId does not match the subject assigned to this course",
      });
    }

    // Find coach
    const coach = await Coach.findById(coachId);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    // Existing business rule: one coach can only teach one class.
    const existingClass = await Class.findOne({ coachId });

    if (existingClass) {
      return res.status(409).json({
        success: false,
        message: "This coach is already assigned to another class",
      });
    }

    // Derive subjectId from Course instead of trusting the request.
    const newClass = await Class.create({
      name: name.trim(),
      subjectId: course.subjectId,
      courseId: course._id,
      coachId: coach._id,
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

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This coach is already assigned to another class",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ==========================================
// GET ALL CLASSES
// GET /api/classes
// ==========================================
const getClasses = async (req, res) => {
  try {
    const classes = await Class.find()
      .populate("subjectId", "name")
      .populate("courseId", "name description price status subjectId")
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

// ==========================================
// UPDATE CLASS
// PUT /api/classes/:id
// ==========================================
const updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, courseId, coachId, subjectId } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid class ID",
      });
    }

    // Keep the existing full-update contract.
    if (
      typeof name !== "string" ||
      !name.trim() ||
      !mongoose.isValidObjectId(courseId) ||
      !mongoose.isValidObjectId(coachId)
    ) {
      return res.status(400).json({
        success: false,
        message: "name, valid courseId and valid coachId are required",
      });
    }

    if (
      subjectId !== undefined &&
      !mongoose.isValidObjectId(subjectId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid subjectId",
      });
    }

    const existingClass = await Class.findById(id);

    if (!existingClass) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Find selected course
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (!course.subjectId) {
      return res.status(409).json({
        success: false,
        message:
          "This course has no subject assigned. Update the course first.",
      });
    }

    const subject = await Subject.findById(course.subjectId);

    if (!subject) {
      return res.status(409).json({
        success: false,
        message:
          "The subject linked to this course does not exist. Please fix the course first.",
      });
    }

    if (
      subjectId !== undefined &&
      subjectId.toString() !== course.subjectId.toString()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "subjectId does not match the subject assigned to this course",
      });
    }

    // Find selected coach
    const coach = await Coach.findById(coachId);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    // Ensure no other class is assigned to this coach.
    const classUsingCoach = await Class.findOne({
      coachId,
      _id: { $ne: id },
    });

    if (classUsingCoach) {
      return res.status(409).json({
        success: false,
        message: "This coach is already assigned to another class",
      });
    }

    // A class with dependent teaching data must not be moved to another course,
    // otherwise its lessons/learning paths and historical records may mismatch.
    if (course._id.toString() !== existingClass.courseId.toString()) {
      const [lesson, schedule, registration, attendance, homework] = await Promise.all([
        Lesson.findOne({ classId: existingClass._id }),
        Schedule.findOne({ classId: existingClass._id }),
        ClassRegistration.findOne({ classId: existingClass._id }),
        Attendance.findOne({ classId: existingClass._id }),
        Homework.findOne({ classId: existingClass._id }),
      ]);

      if (lesson || schedule || registration || attendance || homework) {
        return res.status(409).json({
          success: false,
          message:
            "Cannot change the course of a class while it has lessons, schedules, registrations, attendance records or homework",
        });
      }
    }

    existingClass.name = name.trim();
    existingClass.subjectId = course.subjectId;
    existingClass.courseId = course._id;
    existingClass.coachId = coach._id;

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

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This coach is already assigned to another class",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ==========================================
// DELETE CLASS
// DELETE /api/classes/:id
// ==========================================
const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid class ID",
      });
    }

    const existingClass = await Class.findById(id);

    if (!existingClass) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Protect all records that reference this class.
    const [lesson, schedule, registration, attendance, homework] = await Promise.all([
      Lesson.findOne({ classId: existingClass._id }),
      Schedule.findOne({ classId: existingClass._id }),
      ClassRegistration.findOne({ classId: existingClass._id }),
      Attendance.findOne({ classId: existingClass._id }),
      Homework.findOne({ classId: existingClass._id }),
    ]);

    if (lesson || schedule || registration || attendance || homework) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete class because it has related lessons, schedules, registrations, attendance records or homework",
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
