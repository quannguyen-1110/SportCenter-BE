const mongoose = require("mongoose");

const Schedule = require("../models/Schedule");
const Member = require("../models/Member");
const ClassRegistration = require("../models/ClassRegistration");
const Coach = require("../models/Coach");
const Class = require("../models/Class");
const Lesson = require("../models/Lesson");
const Room = require("../models/Room");
const XLSX = require("xlsx");

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
      select: "title description order classId learningPathId",
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

  // A lesson must belong to the selected class.
  if (!lesson.classId) {
    return {
      valid: false,
      status: 409,
      message:
        "This lesson is not assigned to a class. Please assign it to a class first.",
    };
  }

  if (lesson.classId.toString() !== classItem._id.toString()) {
    return {
      valid: false,
      status: 400,
      message:
        "The selected lesson does not belong to the selected class.",
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
// IMPORT schedules from Excel
const importSchedules = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "Please upload an Excel file",
      });
    }

    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer",
      cellDates: true,
    });

    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return res.status(400).json({
        success: false,
        message: "The Excel file has no worksheet",
      });
    }

    const worksheet = workbook.Sheets[firstSheetName];

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      defval: "",
      raw: true,
    });

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "The Excel file contains no schedule data",
      });
    }

    const requiredColumns = [
      "classId",
      "lessonId",
      "roomId",
      "date",
      "startTime",
      "endTime",
    ];

    const actualColumns = Object.keys(rows[0]);

    const missingColumns = requiredColumns.filter(
      (column) => !actualColumns.includes(column)
    );

    if (missingColumns.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid Excel template",
        missingColumns,
      });
    }

    if (rows.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "A maximum of 1000 schedule rows is allowed per import",
      });
    }

    // Parse dates from Excel.
    // Accepted formats: Excel date cells or YYYY-MM-DD text.
    const parseExcelDate = (value) => {
      if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;

        return new Date(
          Date.UTC(
            value.getUTCFullYear(),
            value.getUTCMonth(),
            value.getUTCDate()
          )
        );
      }

      if (typeof value === "number") {
        const parsed = XLSX.SSF.parse_date_code(value);

        if (!parsed) return null;

        return new Date(
          Date.UTC(parsed.y, parsed.m - 1, parsed.d)
        );
      }

      if (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
      ) {
        const text = value.trim();
        const parsed = new Date(`${text}T00:00:00.000Z`);

        if (
          Number.isNaN(parsed.getTime()) ||
          parsed.toISOString().slice(0, 10) !== text
        ) {
          return null;
        }

        return parsed;
      }

      return null;
    };

    const importedSchedules = [];
    const errors = [];

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const excelRow = index + 2;

      // Ignore completely empty rows.
      const hasData = Object.values(row).some(
        (value) => String(value).trim() !== ""
      );

      if (!hasData) continue;

      try {
        const classId = String(row.classId).trim();
        const lessonId = String(row.lessonId).trim();
        const roomId = String(row.roomId).trim();
        const startTime = String(row.startTime).trim();
        const endTime = String(row.endTime).trim();

        const status = String(row.status || "SCHEDULED")
          .trim()
          .toUpperCase();

        const date = parseExcelDate(row.date);

        if (
          !classId ||
          !lessonId ||
          !roomId ||
          !row.date ||
          !startTime ||
          !endTime
        ) {
          errors.push({
            row: excelRow,
            message: "Missing required data",
          });
          continue;
        }

        if (
          !isValidTime(startTime) ||
          !isValidTime(endTime) ||
          startTime >= endTime
        ) {
          errors.push({
            row: excelRow,
            message:
              "Invalid time. Use HH:mm and ensure startTime is earlier than endTime",
          });
          continue;
        }

        if (!date) {
          errors.push({
            row: excelRow,
            message: "Invalid date. Use an Excel date cell or YYYY-MM-DD",
          });
          continue;
        }

        if (!VALID_STATUSES.includes(status)) {
          errors.push({
            row: excelRow,
            message: "Invalid status",
          });
          continue;
        }

        const references = await validateReferences(
          classId,
          lessonId,
          roomId
        );

        if (!references.valid) {
          errors.push({
            row: excelRow,
            message: references.message,
          });
          continue;
        }

        // Check conflicts with existing schedules.
        // Earlier successful rows in this import are also checked,
        // because they are already saved in the database.
        if (status !== "CANCELLED") {
          const conflict = await findRoomConflict({
            roomId,
            date,
            startTime,
            endTime,
          });

          if (conflict) {
            errors.push({
              row: excelRow,
              message: "Room has an overlapping schedule",
              conflictingScheduleId: conflict._id,
            });
            continue;
          }
        }

        const schedule = await Schedule.create({
          classId,
          lessonId,
          roomId,
          date,
          startTime,
          endTime,
          status,
        });

        importedSchedules.push({
          row: excelRow,
          scheduleId: schedule._id,
        });
      } catch (rowError) {
        console.error(
          `Import schedule row ${excelRow} error:`,
          rowError
        );

        errors.push({
          row: excelRow,
          message: "Failed to import this row",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message:
        errors.length === 0
          ? "Schedules imported successfully"
          : "Import completed with some errors",
      data: {
        totalRows: importedSchedules.length + errors.length,
        successCount: importedSchedules.length,
        errorCount: errors.length,
        importedSchedules,
        errors,
      },
    });
  } catch (error) {
    console.error("Import schedules error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to import schedules",
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
  importSchedules,
};