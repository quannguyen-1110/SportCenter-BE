const mongoose = require("mongoose");

const Schedule = require("../models/Schedule");
const Member = require("../models/Member");
const ClassRegistration = require("../models/ClassRegistration");
const Coach = require("../models/Coach");
const Class = require("../models/Class");
const Lesson = require("../models/Lesson");
const Room = require("../models/Room");

const VALID_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"];

// Validate ObjectId
const isValidId = (id) => mongoose.isValidObjectId(id);

// Validate time format HH:mm
const isValidTime = (time) =>
  typeof time === "string" &&
  /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

// Normalize date to UTC midnight
const normalizeDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setUTCHours(0, 0, 0, 0);

  return date;
};

// Get the start and end of a UTC day
const getDayRange = (date) => {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
};

// Populate Schedule information
const populateSchedule = (query) => {
  return query
    .populate({
      path: "classId",
      select: "name subjectId courseId coachId",
      populate: [
        {
          path: "subjectId",
          select: "name",
        },
        {
          path: "courseId",
          select: "name description status",
        },
        {
          path: "coachId",
          select: "fullName phone",
        },
      ],
    })
    .populate({
      path: "lessonId",
      select: "title description order learningPathId",
    })
    .populate({
      path: "roomId",
      select: "roomNumber name capacity status",
    });
};

// Validate the Class, Lesson and Room references
const validateReferences = async (classId, lessonId, roomId) => {
  if (
    !isValidId(classId) ||
    !isValidId(lessonId) ||
    !isValidId(roomId)
  ) {
    return {
      valid: false,
      status: 400,
      message: "Invalid classId, lessonId or roomId",
    };
  }

  const [classItem, lesson, room] = await Promise.all([
    Class.findById(classId),
    Lesson.findById(lessonId),
    Room.findById(roomId),
  ]);

  if (!classItem) {
    return {
      valid: false,
      status: 404,
      message: "Class not found",
    };
  }

  if (!lesson) {
    return {
      valid: false,
      status: 404,
      message: "Lesson not found",
    };
  }

  if (!room) {
    return {
      valid: false,
      status: 404,
      message: "Room not found",
    };
  }

  if (room.status !== "ACTIVE") {
    return {
      valid: false,
      status: 400,
      message: "The selected room is not active",
    };
  }

  return {
    valid: true,
    classItem,
    lesson,
    room,
  };
};

// Check whether the room has another schedule at an overlapping time
const findRoomConflict = async ({
  roomId,
  date,
  startTime,
  endTime,
  excludeScheduleId = null,
}) => {
  const { start, end } = getDayRange(date);

  const filter = {
    roomId,
    date: {
      $gte: start,
      $lt: end,
    },
    status: { $ne: "CANCELLED" },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };

  if (excludeScheduleId) {
    filter._id = { $ne: excludeScheduleId };
  }

  return Schedule.findOne(filter);
};

// CREATE schedule
const createSchedule = async (req, res) => {
  try {
    const {
      classId,
      lessonId,
      roomId,
      date,
      startTime,
      endTime,
      status,
    } = req.body;

    if (
      !classId ||
      !lessonId ||
      !roomId ||
      !date ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          "classId, lessonId, roomId, date, startTime and endTime are required",
      });
    }

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      return res.status(400).json({
        success: false,
        message: "Time must use HH:mm format",
      });
    }

    if (startTime >= endTime) {
      return res.status(400).json({
        success: false,
        message: "startTime must be earlier than endTime",
      });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule status",
      });
    }

    const normalizedDate = normalizeDate(date);

    if (!normalizedDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid date",
      });
    }

    const references = await validateReferences(
      classId,
      lessonId,
      roomId
    );

    if (!references.valid) {
      return res.status(references.status).json({
        success: false,
        message: references.message,
      });
    }

    const scheduleStatus = status || "SCHEDULED";

    if (scheduleStatus !== "CANCELLED") {
      const conflict = await findRoomConflict({
        roomId,
        date: normalizedDate,
        startTime,
        endTime,
      });

      if (conflict) {
        return res.status(409).json({
          success: false,
          message:
            "This room already has a schedule during the selected time",
          data: {
            conflictingScheduleId: conflict._id,
            date: conflict.date,
            startTime: conflict.startTime,
            endTime: conflict.endTime,
          },
        });
      }
    }

    const schedule = await Schedule.create({
      classId,
      lessonId,
      roomId,
      date: normalizedDate,
      startTime,
      endTime,
      status: scheduleStatus,
    });

    const result = await populateSchedule(
      Schedule.findById(schedule._id)
    );

    return res.status(201).json({
      success: true,
      message: "Schedule created successfully",
      data: result,
    });
  } catch (error) {
    console.error("Create schedule error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET all schedules
const getSchedules = async (req, res) => {
  try {
    const schedules = await populateSchedule(Schedule.find())
      .sort({
        date: 1,
        startTime: 1,
      });

    return res.status(200).json({
      success: true,
      message: "Schedules retrieved successfully",
      data: schedules,
    });
  } catch (error) {
    console.error("Get schedules error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET schedules of current member
const getMySchedules = async (req, res) => {
  try {
    const member = await Member.findOne({
      userId: req.user.userId,
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member profile not found",
      });
    }

    const registrations = await ClassRegistration.find({
      memberId: member._id,
      status: "CONFIRMED",
    }).select("classId");

    const classIds = registrations.map(
      (registration) => registration.classId
    );

    const schedules = await populateSchedule(
      Schedule.find({
        classId: { $in: classIds },
      })
    ).sort({
      date: 1,
      startTime: 1,
    });

    return res.status(200).json({
      success: true,
      message: "My schedules retrieved successfully",
      data: schedules,
    });
  } catch (error) {
    console.error("Get my schedules error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET schedules of current coach
const getMyCoachSchedules = async (req, res) => {
  try {
    const coach = await Coach.findOne({
      userId: req.user.userId,
    });

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
    }

    // Find classes assigned to the current coach
    const classes = await Class.find({
      coachId: coach._id,
    }).select("_id");

    const classIds = classes.map((item) => item._id);

    // Find schedules belonging to those classes
    const schedules = await populateSchedule(
      Schedule.find({
        classId: { $in: classIds },
      })
    ).sort({
      date: 1,
      startTime: 1,
    });

    return res.status(200).json({
      success: true,
      message: "My teaching schedules retrieved successfully",
      data: schedules,
    });
  } catch (error) {
    console.error("Get my coach schedules error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// UPDATE schedule
const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      classId,
      lessonId,
      roomId,
      date,
      startTime,
      endTime,
      status,
    } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule id",
      });
    }

    if (
      !classId ||
      !lessonId ||
      !roomId ||
      !date ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          "classId, lessonId, roomId, date, startTime and endTime are required",
      });
    }

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      return res.status(400).json({
        success: false,
        message: "Time must use HH:mm format",
      });
    }

    if (startTime >= endTime) {
      return res.status(400).json({
        success: false,
        message: "startTime must be earlier than endTime",
      });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule status",
      });
    }

    const normalizedDate = normalizeDate(date);

    if (!normalizedDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid date",
      });
    }

    const schedule = await Schedule.findById(id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found",
      });
    }

    const references = await validateReferences(
      classId,
      lessonId,
      roomId
    );

    if (!references.valid) {
      return res.status(references.status).json({
        success: false,
        message: references.message,
      });
    }

    const scheduleStatus = status || schedule.status;

    if (scheduleStatus !== "CANCELLED") {
      const conflict = await findRoomConflict({
        roomId,
        date: normalizedDate,
        startTime,
        endTime,
        excludeScheduleId: id,
      });

      if (conflict) {
        return res.status(409).json({
          success: false,
          message:
            "This room already has a schedule during the selected time",
          data: {
            conflictingScheduleId: conflict._id,
            date: conflict.date,
            startTime: conflict.startTime,
            endTime: conflict.endTime,
          },
        });
      }
    }

    schedule.classId = classId;
    schedule.lessonId = lessonId;
    schedule.roomId = roomId;
    schedule.date = normalizedDate;
    schedule.startTime = startTime;
    schedule.endTime = endTime;
    schedule.status = scheduleStatus;

    await schedule.save();

    const result = await populateSchedule(
      Schedule.findById(schedule._id)
    );

    return res.status(200).json({
      success: true,
      message: "Schedule updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Update schedule error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE schedule
const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule id",
      });
    }

    const schedule = await Schedule.findById(id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found",
      });
    }

    await Schedule.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Schedule deleted successfully",
    });
  } catch (error) {
    console.error("Delete schedule error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createSchedule,
  getSchedules,
  getMySchedules,
  getMyCoachSchedules,
  updateSchedule,
  deleteSchedule,
};