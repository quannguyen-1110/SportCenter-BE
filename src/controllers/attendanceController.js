const Attendance = require("../models/Attendance");
const Member = require("../models/Member");
const Class = require("../models/Class");
const Lesson = require("../models/Lesson");

// CREATE attendance
const createAttendance = async (req, res) => {
  try {
    const {
      memberId,
      classId,
      lessonId,
      date,
      status,
    } = req.body;

    // Validate required fields
    if (
      !memberId ||
      !classId ||
      !lessonId ||
      !date ||
      !status
    ) {
      return res.status(400).json({
        success: false,
        message:
          "memberId, classId, lessonId, date and status are required",
      });
    }

    // Validate status
    const validStatuses = ["PRESENT", "ABSENT"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status must be PRESENT or ABSENT",
      });
    }

    // Validate date
    const attendanceDate = new Date(date);

    if (Number.isNaN(attendanceDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date",
      });
    }

    // Check member
    const member = await Member.findById(memberId);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    // Check class
    const classData = await Class.findById(classId);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Check lesson
    const lesson = await Lesson.findById(lessonId);

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    // Check duplicate attendance
    const existingAttendance =
      await Attendance.findOne({
        memberId,
        classId,
        lessonId,
        date: attendanceDate,
      });

    if (existingAttendance) {
      return res.status(409).json({
        success: false,
        message:
          "Attendance already recorded for this member, class, lesson and date",
      });
    }

    // Create attendance
    const attendance = await Attendance.create({
      memberId,
      classId,
      lessonId,
      date: attendanceDate,
      status,
    });

    return res.status(201).json({
      success: true,
      message: "Attendance recorded successfully",
      data: {
        id: attendance._id,
        memberId: attendance.memberId,
        classId: attendance.classId,
        lessonId: attendance.lessonId,
        date: attendance.date,
        status: attendance.status,
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

// GET all attendances
const getAttendances = async (req, res) => {
  try {
    const attendances = await Attendance.find()
      .populate(
        "memberId",
        "fullName phone goal level"
      )
      .populate(
        "classId",
        "name subjectId courseId coachId"
      )
      .populate(
        "lessonId",
        "title description order learningPathId"
      )
      .sort({
        date: -1,
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      message: "Attendances retrieved successfully",
      data: attendances,
    });
  } catch (error) {
    console.error("Get attendances error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// UPDATE attendance
const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      memberId,
      classId,
      lessonId,
      date,
      status,
    } = req.body;

    // Validate required fields
    if (
      !memberId ||
      !classId ||
      !lessonId ||
      !date ||
      !status
    ) {
      return res.status(400).json({
        success: false,
        message:
          "memberId, classId, lessonId, date and status are required",
      });
    }

    // Validate status
    const validStatuses = ["PRESENT", "ABSENT"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status must be PRESENT or ABSENT",
      });
    }

    // Validate date
    const attendanceDate = new Date(date);

    if (Number.isNaN(attendanceDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date",
      });
    }

    // Check attendance
    const attendance =
      await Attendance.findById(id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance not found",
      });
    }

    // Check member
    const member = await Member.findById(memberId);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    // Check class
    const classData = await Class.findById(classId);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Check lesson
    const lesson = await Lesson.findById(lessonId);

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    // Check duplicate attendance
    const existingAttendance =
      await Attendance.findOne({
        memberId,
        classId,
        lessonId,
        date: attendanceDate,
        _id: { $ne: id },
      });

    if (existingAttendance) {
      return res.status(409).json({
        success: false,
        message:
          "Attendance already recorded for this member, class, lesson and date",
      });
    }

    // Update attendance
    attendance.memberId = memberId;
    attendance.classId = classId;
    attendance.lessonId = lessonId;
    attendance.date = attendanceDate;
    attendance.status = status;

    await attendance.save();

    return res.status(200).json({
      success: true,
      message: "Attendance updated successfully",
      data: attendance,
    });
  } catch (error) {
    console.error("Update attendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE attendance
const deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    const attendance =
      await Attendance.findById(id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance not found",
      });
    }

    await Attendance.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Attendance deleted successfully",
    });
  } catch (error) {
    console.error("Delete attendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createAttendance,
  getAttendances,
  updateAttendance,
  deleteAttendance,
};