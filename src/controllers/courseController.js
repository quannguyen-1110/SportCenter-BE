
const mongoose = require("mongoose");

const Course = require("../models/Course");
const Subject = require("../models/Subject");
const Class = require("../models/Class");
const LearningPath = require("../models/LearningPath");

// ==========================================
// CREATE COURSE
// POST /api/courses
// ==========================================
const createCourse = async (req, res) => {
  try {
    const { subjectId, name, description, price, status } = req.body;

    // Validate subjectId
    if (!subjectId || !mongoose.isValidObjectId(subjectId)) {
      return res.status(400).json({
        success: false,
        message: "A valid subjectId is required",
      });
    }

    const subject = await Subject.findById(subjectId);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    // Validate name
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "name is required",
      });
    }

    if (description !== undefined && typeof description !== "string") {
      return res.status(400).json({
        success: false,
        message: "description must be a string",
      });
    }

    // Keep CREATE and UPDATE consistent: course names are unique globally.
    const existingCourse = await Course.findOne({ name: name.trim() });
    if (existingCourse) {
      return res.status(409).json({
        success: false,
        message: "Course name already exists",
      });
    }

    // Validate price
    if (
      price === undefined ||
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "price is required and must be a non-negative number",
      });
    }

    // Validate status
    const courseStatus = status || "ACTIVE";

    if (!["ACTIVE", "INACTIVE"].includes(courseStatus)) {
      return res.status(400).json({
        success: false,
        message: "status must be ACTIVE or INACTIVE",
      });
    }

    const course = await Course.create({
      subjectId,
      name: name.trim(),
      description:
        typeof description === "string" ? description.trim() : "",
      price,
      status: courseStatus,
    });

    return res.status(201).json({
      success: true,
      message: "Course created successfully",
      data: {
        id: course._id,
        subjectId: course.subjectId,
        name: course.name,
        description: course.description,
        price: course.price,
        status: course.status,
        createdAt: course.createdAt,
      },
    });
  } catch (error) {
    console.error("Create course error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Course already exists with a conflicting unique field",
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
// GET ALL COURSES
// GET /api/courses
// ==========================================
const getCourses = async (req, res) => {
  try {
    const courses = await Course.find()
      .select(
        "_id subjectId name description price status createdAt updatedAt"
      )
      .populate("subjectId", "name")
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

// ==========================================
// UPDATE COURSE
// PUT /api/courses/:id
// ==========================================
const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { subjectId, name, description, price, status } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
    }

    // Validate request body
    if (
      subjectId === undefined &&
      name === undefined &&
      description === undefined &&
      price === undefined &&
      status === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update",
      });
    }

    const course = await Course.findById(id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Update subjectId
    if (subjectId !== undefined) {
      if (!mongoose.isValidObjectId(subjectId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid subjectId",
        });
      }

      const subject = await Subject.findById(subjectId);

      if (!subject) {
        return res.status(404).json({
          success: false,
          message: "Subject not found",
        });
      }

      // Class stores subjectId as well as courseId. Prevent making those values
      // inconsistent by reassigning a course that is already used by a class.
      if (
        !course.subjectId ||
        course.subjectId.toString() !== subjectId.toString()
      ) {
        const existingClass = await Class.findOne({ courseId: course._id });
        if (existingClass) {
          return res.status(409).json({
            success: false,
            message:
              "Cannot change the subject of a course while it is assigned to a class",
          });
        }
      }

      course.subjectId = subjectId;
    }

    // Update name
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
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
      if (typeof description !== "string") {
        return res.status(400).json({
          success: false,
          message: "description must be a string",
        });
      }

      course.description = description.trim();
    }

    // Update price
    if (price !== undefined) {
      if (
        typeof price !== "number" ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "price must be a non-negative number",
        });
      }

      course.price = price;
    }

    // Update status
    if (status !== undefined) {
      if (!["ACTIVE", "INACTIVE"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "status must be ACTIVE or INACTIVE",
        });
      }

      course.status = status;
    }

    await course.save();
    await course.populate("subjectId", "name");

    return res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: {
        id: course._id,
        subjectId: course.subjectId,
        name: course.name,
        description: course.description,
        price: course.price,
        status: course.status,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update course error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Course name already exists",
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
// DELETE COURSE
// DELETE /api/courses/:id
// ==========================================
const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
    }

    const course = await Course.findById(id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Prevent deleting a course used by a class.
    const existingClass = await Class.findOne({
      courseId: id,
    });

    if (existingClass) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete course because it is being used by a class",
      });
    }

    // Prevent deleting a course used by a learning path.
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
