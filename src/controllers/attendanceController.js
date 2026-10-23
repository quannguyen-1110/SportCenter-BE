const Attendance = require("../models/Attendance");
const Member = require("../models/Member");
const Class = require("../models/Class");
const Lesson = require("../models/Lesson");
const Coach = require("../models/Coach");
const Schedule = require("../models/Schedule");
const ClassRegistration = require("../models/ClassRegistration");

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

// Ensure the lesson belongs to the selected class
if (!lesson.classId) {
  return res.status(409).json({
    success: false,
    message: "This lesson has not been assigned to a class",
  });
}

if (lesson.classId.toString() !== classData._id.toString()) {
  return res.status(400).json({
    success: false,
    message: "The selected lesson does not belong to the selected class",
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
// CREATE attendance by current coach
const createCoachAttendance = async (req, res) => {
  try {
    const { memberId, scheduleId, status } = req.body;

    if (!memberId || !scheduleId || !status) {
      return res.status(400).json({
        success: false,
        message: "memberId, scheduleId and status are required",
      });
    }

    if (!["PRESENT", "ABSENT"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status must be PRESENT or ABSENT",
      });
    }

    const coach = await Coach.findOne({
      userId: req.user.userId,
    });

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
    }

    const schedule = await Schedule.findById(scheduleId);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found",
      });
    }

    const classData = await Class.findOne({
      _id: schedule.classId,
      coachId: coach._id,
    });

    if (!classData) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this class",
      });
    }

    const lesson = await Lesson.findById(schedule.lessonId);

if (!lesson) {
  return res.status(404).json({
    success: false,
    message: "Lesson not found",
  });
}

if (!lesson.classId) {
  return res.status(409).json({
    success: false,
    message: "This lesson has not been assigned to a class",
  });
}

if (lesson.classId.toString() !== classData._id.toString()) {
  return res.status(400).json({
    success: false,
    message: "The scheduled lesson does not belong to this class",
  });
}

    const member = await Member.findById(memberId);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    const registration = await ClassRegistration.findOne({
      classId: classData._id,
      memberId,
      status: "CONFIRMED",
    });

    if (!registration) {
      return res.status(400).json({
        success: false,
        message: "Member is not confirmed for this class",
      });
    }

    const attendanceDate = new Date(schedule.date);
    attendanceDate.setUTCHours(0, 0, 0, 0);

    const existingAttendance = await Attendance.findOne({
      memberId,
      classId: classData._id,
      lessonId: schedule.lessonId,
      date: attendanceDate,
    });

    if (existingAttendance) {
      return res.status(409).json({
        success: false,
        message: "Attendance already recorded for this member, class, lesson and date",
      });
    }

    const attendance = await Attendance.create({
      memberId,
      classId: classData._id,
      lessonId: schedule.lessonId,
      date: attendanceDate,
      status,
    });

    return res.status(201).json({
      success: true,
      message: "Attendance recorded successfully",
      data: attendance,
    });
  } catch (error) {
    console.error("Create coach attendance error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Attendance already recorded",
      });
    }

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
// GET attendance records for a schedule by current coach
const getAttendanceByScheduleForCoach = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const coach = await Coach.findOne({
      userId: req.user.userId,
    });

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
    }

    const schedule = await Schedule.findById(scheduleId);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found",
      });
    }

    const classData = await Class.findOne({
      _id: schedule.classId,
      coachId: coach._id,
    });

    if (!classData) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this class",
      });
    }
// Validate that the scheduled lesson belongs to this class
const lesson = await Lesson.findById(schedule.lessonId);

if (!lesson) {
  return res.status(404).json({
    success: false,
    message: "Lesson not found",
  });
}

if (!lesson.classId) {
  return res.status(409).json({
    success: false,
    message: "This lesson has not been assigned to a class",
  });
}

if (lesson.classId.toString() !== classData._id.toString()) {
  return res.status(400).json({
    success: false,
    message: "The scheduled lesson does not belong to this class",
  });
}
    const attendanceDate = new Date(schedule.date);
    attendanceDate.setUTCHours(0, 0, 0, 0);

    const attendances = await Attendance.find({
      classId: schedule.classId,
      lessonId: schedule.lessonId,
      date: attendanceDate,
    })
      .populate("memberId", "fullName phone goal level")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      message: "Schedule attendance retrieved successfully",
      data: attendances,
    });
  } catch (error) {
    console.error("Get schedule attendance for coach error:", error);

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

// Ensure the lesson belongs to the selected class
if (!lesson.classId) {
  return res.status(409).json({
    success: false,
    message: "This lesson has not been assigned to a class",
  });
}

if (lesson.classId.toString() !== classData._id.toString()) {
  return res.status(400).json({
    success: false,
    message: "The selected lesson does not belong to the selected class",
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

// GET attendance history of the logged-in member
const getMyAttendances = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Find the Member profile from the logged-in account
    const member = await Member.findOne({
      userId: req.user.userId,
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member profile not found",
      });
    }

    // Only retrieve attendance records belonging to this member
    const attendances = await Attendance.find({
      memberId: member._id,
    })
      .populate("classId", "name subjectId courseId coachId")
      .populate("lessonId", "title description order learningPathId")
      .sort({
        date: -1,
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      message: "Personal attendance history retrieved successfully",
      data: attendances,
    });
  } catch (error) {
    console.error("Get personal attendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createAttendance,
  createCoachAttendance,
  getAttendances,
  getAttendanceByScheduleForCoach,
  updateAttendance,
  deleteAttendance,
  getMyAttendances,
};