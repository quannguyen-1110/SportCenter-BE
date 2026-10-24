
const express = require("express");
const multer = require("multer");
const path = require("path");

const {
  createSchedule,
  getSchedules,
  getMySchedules,
  getMyCoachSchedules,
  updateSchedule,
  deleteSchedule,
  importSchedules,
} = require("../controllers/scheduleController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (extension !== ".xlsx") {
      return callback(new Error("Only .xlsx Excel files are allowed"));
    }

    callback(null, true);
  },
});

// Return upload errors as JSON
const uploadExcel = (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message || "Invalid Excel file",
      });
    }

    next();
  });
};
/**
 * @swagger
 * /api/schedules:
 *   post:
 *     summary: Create a schedule
 *     description: |
 *       "Access: CENTER_MANAGER"
 *
 *       Each schedule must specify a room.
 *       A room cannot have overlapping non-cancelled schedules.
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - classId
 *               - lessonId
 *               - roomId
 *               - date
 *               - startTime
 *               - endTime
 *             properties:
 *               classId:
 *                 type: string
 *                 example: 67abc1234567890123456789
 *               lessonId:
 *                 type: string
 *                 example: 67def1234567890123456789
 *               roomId:
 *                 type: string
 *                 description: ID of the room assigned to this schedule
 *                 example: 67fed1234567890123456789
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2026-10-19"
 *               startTime:
 *                 type: string
 *                 example: "08:00"
 *               endTime:
 *                 type: string
 *                 example: "10:00"
 *               status:
 *                 type: string
 *                 enum: [SCHEDULED, COMPLETED, CANCELLED]
 *                 example: SCHEDULED
 *     responses:
 *       201:
 *         description: Schedule created successfully
 *       400:
 *         description: Invalid data, missing required fields, or inactive room
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Class, lesson, or room not found
 *       409:
 *         description: The room already has an overlapping schedule
 *       500:
 *         description: Internal server error
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  createSchedule
);

/**
 * @swagger
 * /api/schedules:
 *   get:
 *     summary: Get all schedules
 *     description: |
 *       "Access: ALL AUTHENTICATED ROLES"
 *
 *       Returns schedules with class, lesson, coach and room details.
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Schedules retrieved successfully
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.get("/", authMiddleware, getSchedules);

/**
 * @swagger
 * /api/schedules/my:
 *   get:
 *     summary: Get current member's schedules
 *     description: |
 *       "Access: MEMBER"
 *
 *       Returns schedules for classes where the member has a
 *       CONFIRMED registration, including room information.
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Member schedules retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Member profile not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/my",
  authMiddleware,
  roleMiddleware("MEMBER"),
  getMySchedules
);

/**
 * @swagger
 * /api/schedules/coach/my:
 *   get:
 *     summary: Get current coach's teaching schedules
 *     description: |
 *       "Access: COACH"
 *
 *       Returns schedules for classes assigned to the authenticated
 *       coach, including room information.
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Coach schedules retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Coach profile not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/coach/my",
  authMiddleware,
  roleMiddleware("COACH"),
  getMyCoachSchedules
);
/**
 * @swagger
 * /api/schedules/import:
 *   post:
 *     summary: Import schedules from Excel
 *     description: Only CENTER_MANAGER can import schedules.
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Excel file (.xlsx), maximum 5 MB
 *     responses:
 *       200:
 *         description: Import completed, including any row errors
 *       400:
 *         description: Invalid file or Excel data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       500:
 *         description: Import failed
 */
router.post(
  "/import",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  uploadExcel,
  importSchedules
);
/**
 * @swagger
 * /api/schedules/{id}:
 *   put:
 *     summary: Update a schedule
 *     description: |
 *       "Access: CENTER_MANAGER"
 *
 *       The request must include roomId. The API checks for room
 *       scheduling conflicts before updating the schedule.
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 67abc1234567890123456789
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - classId
 *               - lessonId
 *               - roomId
 *               - date
 *               - startTime
 *               - endTime
 *             properties:
 *               classId:
 *                 type: string
 *                 example: 67abc1234567890123456789
 *               lessonId:
 *                 type: string
 *                 example: 67def1234567890123456789
 *               roomId:
 *                 type: string
 *                 example: 67fed1234567890123456789
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2026-10-19"
 *               startTime:
 *                 type: string
 *                 example: "08:00"
 *               endTime:
 *                 type: string
 *                 example: "10:00"
 *               status:
 *                 type: string
 *                 enum: [SCHEDULED, COMPLETED, CANCELLED]
 *                 example: SCHEDULED
 *     responses:
 *       200:
 *         description: Schedule updated successfully
 *       400:
 *         description: Invalid data or missing required fields
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Schedule, class, lesson, or room not found
 *       409:
 *         description: The room already has an overlapping schedule
 *       500:
 *         description: Internal server error
 */
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  updateSchedule
);

/**
 * @swagger
 * /api/schedules/{id}:
 *   delete:
 *     summary: Delete a schedule
 *     description: "Access: CENTER_MANAGER"
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 67abc1234567890123456789
 *     responses:
 *       200:
 *         description: Schedule deleted successfully
 *       400:
 *         description: Invalid schedule ID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Schedule not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  deleteSchedule
);

module.exports = router;
