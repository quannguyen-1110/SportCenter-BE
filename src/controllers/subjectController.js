const Subject = require("../models/Subject");
const Class = require("../models/Class");

// CREATE subject
const createSubject = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Subject name is required",
      });
    }

    const existingSubject = await Subject.findOne({
      name: name.trim(),
    });

    if (existingSubject) {
      return res.status(409).json({
        success: false,
        message: "Subject already exists",
      });
    }

    const subject = await Subject.create({
      name: name.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Subject created successfully",
      data: {
        id: subject._id,
        name: subject.name,
      },
    });
  } catch (error) {
    console.error("Create subject error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET all subjects
const getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find()
      .select("_id name createdAt updatedAt")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Subjects retrieved successfully",
      data: subjects,
    });
  } catch (error) {
    console.error("Get subjects error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// UPDATE subject
const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Subject name is required",
      });
    }

    const subject = await Subject.findById(id);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    const existingSubject = await Subject.findOne({
      name: name.trim(),
      _id: { $ne: id },
    });

    if (existingSubject) {
      return res.status(409).json({
        success: false,
        message: "Subject already exists",
      });
    }

    subject.name = name.trim();

    await subject.save();

    return res.status(200).json({
      success: true,
      message: "Subject updated successfully",
      data: {
        id: subject._id,
        name: subject.name,
      },
    });
  } catch (error) {
    console.error("Update subject error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE subject
const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;

    const subject = await Subject.findById(id);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    const classUsingSubject = await Class.findOne({
      subjectId: id,
    });

    if (classUsingSubject) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete subject because it is being used by a class",
      });
    }

    await Subject.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Subject deleted successfully",
    });
  } catch (error) {
    console.error("Delete subject error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createSubject,
  getSubjects,
  updateSubject,
  deleteSubject,
};