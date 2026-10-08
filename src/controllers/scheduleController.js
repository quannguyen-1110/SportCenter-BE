const Schedule = require("../models/Schedule");
const Member = require("../models/Member");
const ClassRegistration = require("../models/ClassRegistration");

// CREATE schedule
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

// GET all schedules
const getSchedules = async (req, res) => {
  try {
    const schedules = await Schedule.find()
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
        select:
          "title description order learningPathId",
      })
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

    const schedules = await Schedule.find({
      classId: { $in: classIds },
    })
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
        select:
          "title description order learningPathId",
      })
      .sort({
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

// UPDATE schedule
const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;

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

    const schedule = await Schedule.findById(id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found",
      });
    }

    schedule.classId = classId;
    schedule.lessonId = lessonId;
    schedule.date = date;
    schedule.startTime = startTime;
    schedule.endTime = endTime;

    if (status) {
      schedule.status = status;
    }

    await schedule.save();

    return res.status(200).json({
      success: true,
      message: "Schedule updated successfully",
      data: schedule,
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
  updateSchedule,
  deleteSchedule,
};