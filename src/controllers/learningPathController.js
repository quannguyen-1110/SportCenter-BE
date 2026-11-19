
const mongoose = require("mongoose");
const LearningPath = require("../models/LearningPath");
const Class = require("../models/Class");
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
      if (String(courseId) !== String(learningPath.courseId) && await Lesson.exists({ learningPathId: id })) {
        return res.status(409).json({ success: false, message: "Cannot change the course of a learning path that has lessons" });
      }
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

// Copy a course curriculum once. The class owns its copies; subsequent template edits do not change them.
const applyLearningPath = async (req, res) => {
  const { id } = req.params;
  const { classId, expectedLessons } = req.body;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(classId) || !Array.isArray(expectedLessons)) {
    return res.status(400).json({ success: false, message: "Valid learning path, classId and expectedLessons are required" });
  }
  const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
  try {
    const lessons = await mongoose.connection.transaction(async session => {
      const classData = await Class.findById(classId).session(session);
      const path = await LearningPath.findById(id).session(session);
      if (!classData || !path) fail(404, "Class or learning path not found");
      if (String(classData.courseId) !== String(path.courseId)) fail(400, "The learning path does not belong to the class course");
      // Serializes competing initializations of this class inside the transaction.
      await Class.updateOne({ _id: classId }, { $inc: { __v: 1 } }, { session });
      if (await Lesson.exists({ classId }).session(session)) fail(409, "Class already has lessons; refresh the schedule preview");
      const templates = await Lesson.find({ learningPathId: id, classId: null }).sort({ order: 1 }).session(session);
      if (!templates.length || templates.some(lesson => !lesson.title?.trim() || !lesson.description?.trim())) {
        fail(400, "The learning path needs complete template lessons before scheduling");
      }
      const actual = templates.map(lesson => ({ id: String(lesson._id), title: lesson.title, description: lesson.description, order: lesson.order }));
      const expected = expectedLessons.map(lesson => ({ id: lesson?.id, title: lesson?.title, description: lesson?.description, order: lesson?.order }));
      if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(409, "Template lessons changed; refresh the schedule preview");
      if (new Set(templates.map(lesson => lesson.order)).size !== templates.length) fail(409, "Template lesson orders must be unique");
      return Lesson.insertMany(templates.map(lesson => ({ classId, learningPathId: id,
        title: lesson.title, description: lesson.description, order: lesson.order })), { session });
    });
    return res.status(201).json({ success: true, message: "Learning path applied successfully", data: lessons });
  } catch (error) {
    if (!error.status) console.error("Apply learning path error:", error);
    return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Internal server error" });
  }
};

module.exports = {
  applyLearningPath,
  createLearningPath,
  getLearningPaths,
  updateLearningPath,
  deleteLearningPath,
};
