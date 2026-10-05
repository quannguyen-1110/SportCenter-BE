const Subject = require("../models/Subject");

const createSubject = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
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

module.exports = {
  createSubject,
  getSubjects,
};