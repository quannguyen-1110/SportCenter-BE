const Attendance = require("../models/Attendance");
const Member = require("../models/Member");
const Class = require("../models/Class");

const createAttendance = async (req, res) => {
  try {
    const { memberId, classId, date } = req.body;

    if (!memberId || !classId || !date) {
      return res.status(400).json({
        success: false,
        message: "memberId, classId and date are required",
      });
    }

    const member = await Member.findById(memberId);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    const classData = await Class.findById(classId);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    const existingAttendance = await Attendance.findOne({
      memberId,
      classId,
      date: new Date(date),
    });

    if (existingAttendance) {
      return res.status(409).json({
        success: false,
        message: "Attendance already recorded for this date",
      });
    }

    const attendance = await Attendance.create({
      memberId,
      classId,
      date: new Date(date),
    });

    return res.status(201).json({
      success: true,
      message: "Attendance recorded successfully",
      data: {
        id: attendance._id,
        memberId: attendance.memberId,
        classId: attendance.classId,
        date: attendance.date,
      },
    });
  } catch (error) {
    console.error("Create attendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createAttendance,
};