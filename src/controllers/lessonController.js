const mongoose = require("mongoose");

const Lesson = require("../models/Lesson");
const LearningPath = require("../models/LearningPath");
const Schedule = require("../models/Schedule");
const Attendance = require("../models/Attendance");
const Class = require("../models/Class");

// Validate MongoDB ObjectId
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Validate Class and LearningPath belong to the same Course
const validateLessonReferences = async (classId, learningPathId) => {
  if (!isValidId(classId) || !isValidId(learningPathId)) {
    return {
      valid: false,
      status: 400,
      message: "Invalid classId or learningPathId",
    };
  }

  const [classData, learningPath] = await Promise.all([
    Class.findById(classId),
    LearningPath.findById(learningPathId),
  ]);

  if (!classData) {
    return {
      valid: false,
      status: 404,
      message: "Class not found",
    };
  }

  if (!learningPath) {
    return {
      valid: false,
      status: 404,
      message: "Learning path not found",
    };
  }

  if (
    !classData.courseId ||
    !learningPath.courseId ||
    classData.courseId.toString() !== learningPath.courseId.toString()
  ) {
    return {
      valid: false,
      status: 400,
      message: "The learning path does not belong to the class course",
    };
  }

  return {
    valid: true,
    classData,
    learningPath,
  };
};

// CREATE lesson
const createLesson = async (req, res) => {
  try {
    const {
      classId,
      learningPathId,
      title,
      description = "",
      order,
    } = req.body;

    if (
      !classId ||
      !learningPathId ||
      typeof title !== "string" ||
      !title.trim() ||
      order === undefined ||
      order === null
    ) {
      return res.status(400).json({
        success: false,
        message:
          "classId, learningPathId, title and order are required",
      });
    }

    const lessonOrder = Number(order);

    if (!Number.isInteger(lessonOrder) || lessonOrder < 1) {
      return res.status(400).json({
        success: false,
        message: "order must be a positive integer",
      });
    }

    const references = await validateLessonReferences(
      classId,
      learningPathId
    );

    if (!references.valid) {
      return res.status(references.status).json({
        success: false,
        message: references.message,
      });
    }

    // Each Class has its own lesson order: 1, 2, 3, ...
    const existingLesson = await Lesson.findOne({
      classId,
      order: lessonOrder,
    });

    if (existingLesson) {
      return res.status(409).json({
        success: false,
        message: "A lesson with this order already exists in this class",
      });
    }

    const lesson = await Lesson.create({
      classId,
      learningPathId,
      title: title.trim(),
      description:
        typeof description === "string" ? description.trim() : "",
      order: lessonOrder,
    });

    return res.status(201).json({
      success: true,
      message: "Lesson created successfully",
      data: lesson,
    });
  } catch (error) {
    console.error("Create lesson error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A lesson with this order already exists in this class",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET all lessons
const getLessons = async (req, res) => {
  try {
    const lessons = await Lesson.find()
      .populate({
        path: "classId",
        select: "name subjectId courseId coachId",
      })
      .populate({
        path: "learningPathId",
        select: "name description courseId",
        populate: {
          path: "courseId",
          select: "name description subjectId status",
        },
      })
      .sort({
        classId: 1,
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

// GET lessons by class
const getLessonsByClass = async (req, res) => {
  try {
    const { classId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid class ID",
      });
    }

    const classData = await Class.findById(classId);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    const lessons = await Lesson.find({ classId })
      .populate({
        path: "learningPathId",
        select: "name description courseId",
      })
      .sort({ order: 1 });

    return res.status(200).json({
      success: true,
      message: "Lessons retrieved successfully",
      data: lessons,
    });
  } catch (error) {
    console.error("Get lessons by class error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
// UPDATE lesson
const updateLesson = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lesson ID",
      });
    }

    const {
      classId,
      learningPathId,
      title,
      description,
      order,
    } = req.body;

    if (
      classId === undefined &&
      learningPathId === undefined &&
      title === undefined &&
      description === undefined &&
      order === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update",
      });
    }

    const lesson = await Lesson.findById(id);

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    const finalClassId =
      classId !== undefined ? classId : lesson.classId;

    const finalLearningPathId =
      learningPathId !== undefined
        ? learningPathId
        : lesson.learningPathId;

    const finalOrder =
      order !== undefined ? Number(order) : lesson.order;

    if (order !== undefined) {
      if (!Number.isInteger(finalOrder) || finalOrder < 1) {
        return res.status(400).json({
          success: false,
          message: "order must be a positive integer",
        });
      }
    }

    if (
      title !== undefined &&
      (typeof title !== "string" || !title.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Lesson title cannot be empty",
      });
    }

    if (
      description !== undefined &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "description must be a string",
      });
    }

    // Validate references when the lesson has a class assigned.
    // This also allows older lessons with classId = null
    // to be edited without immediately migrating every record.
    if (finalClassId) {
      const references = await validateLessonReferences(
        finalClassId,
        finalLearningPathId
      );

      if (!references.valid) {
        return res.status(references.status).json({
          success: false,
          message: references.message,
        });
      }
    } else if (
      !isValidId(finalLearningPathId) ||
      !(await LearningPath.exists({ _id: finalLearningPathId }))
    ) {
      return res.status(404).json({
        success: false,
        message: "Learning path not found",
      });
    }

    // Do not move a lesson to another class if schedules already use it.
    if (
      classId !== undefined &&
      String(classId) !== String(lesson.classId)
    ) {
      const existingSchedule = await Schedule.findOne({
        lessonId: lesson._id,
      });

      if (existingSchedule) {
        return res.status(409).json({
          success: false,
          message:
            "Cannot change the lesson class because the lesson is used by a schedule",
        });
      }
    }

    // Prevent duplicate order within the same class.
    if (finalClassId) {
      const existingLesson = await Lesson.findOne({
        classId: finalClassId,
        order: finalOrder,
        _id: { $ne: lesson._id },
      });

      if (existingLesson) {
        return res.status(409).json({
          success: false,
          message:
            "A lesson with this order already exists in this class",
        });
      }
    }

    if (classId !== undefined) {
      lesson.classId = classId;
    }

    if (learningPathId !== undefined) {
      lesson.learningPathId = learningPathId;
    }

    if (title !== undefined) {
      lesson.title = title.trim();
    }

    if (description !== undefined) {
      lesson.description = description.trim();
    }

    if (order !== undefined) {
      lesson.order = finalOrder;
    }

    await lesson.save();

    return res.status(200).json({
      success: true,
      message: "Lesson updated successfully",
      data: lesson,
    });
  } catch (error) {
    console.error("Update lesson error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A lesson with this order already exists in this class",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE lesson
const deleteLesson = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lesson ID",
      });
    }

    const lesson = await Lesson.findById(id);

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    // Do not delete a lesson that is used by a schedule.
    const schedule = await Schedule.findOne({
      lessonId: lesson._id,
    });

    if (schedule) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete lesson because it is being used by a schedule",
      });
    }

    // Do not delete a lesson that has attendance records.
    const attendance = await Attendance.findOne({
      lessonId: lesson._id,
    });

    if (attendance) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete lesson because it has attendance records",
      });
    }

    await Lesson.findByIdAndDelete(lesson._id);

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
  getLessonsByClass,
  updateLesson,
  deleteLesson,
};