const Class = require("../models/Class");
const Subject = require("../models/Subject");
const Coach = require("../models/Coach");

const createClass = async (req, res) => {
  try {
    const { name, subjectId, coachId } = req.body;

    if (!name || !subjectId || !coachId) {
      return res.status(400).json({
        success: false,
        message: "name, subjectId and coachId are required",
      });
    }

    const subject = await Subject.findById(subjectId);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    const coach = await Coach.findById(coachId);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
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
      subjectId,
      coachId,
    });

    return res.status(201).json({
      success: true,
      message: "Class created successfully",
      data: {
        id: newClass._id,
        name: newClass.name,
        subjectId: newClass.subjectId,
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