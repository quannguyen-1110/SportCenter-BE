const Schedule = require("../models/Schedule");

// Create schedule
const createSchedule = async (req, res) => {
  try {
    const {
      classId,
      lessonId,
      date,
      startTime,
      endTime,
      status,
    } = req.body;

    if (
      !classId ||
      !lessonId ||
      !date ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          "classId, lessonId, date, startTime and endTime are required",
      });
    }

    const schedule = await Schedule.create({
      classId,
      lessonId,
      date,
      startTime,
      endTime,
      status,
    });

    return res.status(201).json({
      success: true,
      message: "Schedule created successfully",
      data: schedule,
    });
  } catch (error) {
    console.error("Create schedule error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get all schedules
const getSchedules = async (req, res) => {
  try {
    const schedules = await Schedule.find()
      .populate({
        path: "classId",
        populate: [
          {
            path: "subjectId",
            select: "name",
          },
          {
            path: "coachId",
            select: "fullName phone",
          },
        ],
      })
      .populate({
        path: "lessonId",
        select: "title description order",
      })
      .sort({
        date: 1,
        startTime: 1,
      });

    return res.status(200).json({
      success: true,
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

module.exports = {
  createSchedule,
  getSchedules,
};