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

const VALID_CLASS_TYPES = ["GROUP", "PERSONAL"];
const isValidId = (id) => mongoose.isValidObjectId(id);

const getClassType = (classData) => classData.classType || "GROUP";

const hasClassDependencies = async (classId) => {
  const [lesson, schedule, registration, attendance, homework] =
    await Promise.all([
      Lesson.findOne({ classId }),
      Schedule.findOne({ classId }),
      ClassRegistration.findOne({ classId }),
      Attendance.findOne({ classId }),
      Homework.findOne({ classId }),
    ]);

  return Boolean(lesson || schedule || registration || attendance || homework);
};

const countActiveRegistrations = (classId) =>
  ClassRegistration.countDocuments({
    classId,
    status: { $in: ["PENDING_PAYMENT", "CONFIRMED"] },
  });

// POST /api/classes
const createClass = async (req, res) => {
  try {
    const {
      name,
      courseId,
      coachId,
      subjectId,
      classType = "GROUP",
    } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, message: "name is required" });
    }

    if (!isValidId(courseId) || !isValidId(coachId)) {
      return res.status(400).json({
        success: false,
        message: "Valid courseId and coachId are required",
      });
    }

    if (subjectId !== undefined && !isValidId(subjectId)) {
      return res.status(400).json({ success: false, message: "Invalid subjectId" });
    }

    if (!VALID_CLASS_TYPES.includes(classType)) {
      return res.status(400).json({
        success: false,
        message: "classType must be GROUP or PERSONAL",
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    if (!course.subjectId) {
      return res.status(409).json({
        success: false,
        message: "This course has no subject assigned. Update the course first.",
      });
    }

    const subject = await Subject.findById(course.subjectId);
    if (!subject) {
      return res.status(409).json({
        success: false,
        message: "The subject linked to this course does not exist. Please fix the course first.",
      });
    }

    if (subjectId !== undefined && subjectId.toString() !== course.subjectId.toString()) {
      return res.status(400).json({
        success: false,
        message: "subjectId does not match the subject assigned to this course",
      });
    }

    const coach = await Coach.findById(coachId);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach not found" });
    }

    const existingClass = await Class.findOne({ coachId });
    if (existingClass) {
      return res.status(409).json({
        success: false,
        message: "This coach is already assigned to another class",
      });
    }

    const newClass = await Class.create({
      name: name.trim(),
      subjectId: course.subjectId,
      courseId: course._id,
      coachId: coach._id,
      classType,
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
        classType: getClassType(newClass),
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
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /api/classes
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
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// PUT /api/classes/:id (existing full-update contract preserved)
const updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, courseId, coachId, subjectId, classType } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: "Invalid class ID" });
    }

    if (
      typeof name !== "string" ||
      !name.trim() ||
      !isValidId(courseId) ||
      !isValidId(coachId)
    ) {
      return res.status(400).json({
        success: false,
        message: "name, valid courseId and valid coachId are required",
      });
    }

    if (subjectId !== undefined && !isValidId(subjectId)) {
      return res.status(400).json({ success: false, message: "Invalid subjectId" });
    }

    if (classType !== undefined && !VALID_CLASS_TYPES.includes(classType)) {
      return res.status(400).json({
        success: false,
        message: "classType must be GROUP or PERSONAL",
      });
    }

    const existingClass = await Class.findById(id);
    if (!existingClass) {
      return res.status(404).json({ success: false, message: "Class not found" });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    if (!course.subjectId) {
      return res.status(409).json({
        success: false,
        message: "This course has no subject assigned. Update the course first.",
      });
    }

    const subject = await Subject.findById(course.subjectId);
    if (!subject) {
      return res.status(409).json({
        success: false,
        message: "The subject linked to this course does not exist. Please fix the course first.",
      });
    }

    if (subjectId !== undefined && subjectId.toString() !== course.subjectId.toString()) {
      return res.status(400).json({
        success: false,
        message: "subjectId does not match the subject assigned to this course",
      });
    }

    const coach = await Coach.findById(coachId);
    if (!coach) {
      return res.status(404).json({ success: false, message: "Coach not found" });
    }

    const classUsingCoach = await Class.findOne({ coachId, _id: { $ne: id } });
    if (classUsingCoach) {
      return res.status(409).json({
        success: false,
        message: "This coach is already assigned to another class",
      });
    }

    // Do not change the course after learning/registration history exists.
    if (course._id.toString() !== existingClass.courseId.toString()) {
      if (await hasClassDependencies(existingClass._id)) {
        return res.status(409).json({
          success: false,
          message: "Cannot change the course of a class while it has lessons, schedules, registrations, attendance records or homework",
        });
      }
    }

    const finalClassType = classType !== undefined
      ? classType
      : getClassType(existingClass);

    // A PERSONAL class has one available slot; pending payment reserves it too.
    if (finalClassType === "PERSONAL") {
      const activeCount = await countActiveRegistrations(existingClass._id);
      if (activeCount > 1) {
        return res.status(409).json({
          success: false,
          message: "Cannot set this class to PERSONAL because it has more than one pending or confirmed registration",
        });
      }
    }

    existingClass.name = name.trim();
    existingClass.subjectId = course.subjectId;
    existingClass.courseId = course._id;
    existingClass.coachId = coach._id;
    existingClass.classType = finalClassType;

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
        classType: getClassType(existingClass),
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
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// DELETE /api/classes/:id
const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: "Invalid class ID" });
    }

    const existingClass = await Class.findById(id);
    if (!existingClass) {
      return res.status(404).json({ success: false, message: "Class not found" });
    }

    if (await hasClassDependencies(existingClass._id)) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete class because it has related lessons, schedules, registrations, attendance records or homework",
      });
    }

    await Class.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: "Class deleted successfully" });
  } catch (error) {
    console.error("Delete class error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { createClass, getClasses, updateClass, deleteClass };
