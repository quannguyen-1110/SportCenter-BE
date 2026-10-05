const express = require("express");

const {
  createAttendance,
  getAttendances,
} = require("../controllers/attendanceController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/attendances:
 *   get:
 *     summary: Get all attendance records
 *     tags: [Attendances]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Attendances retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get(
  "/",
  authMiddleware,
  getAttendances
);

/**
 * @swagger
 * /api/attendances:
 *   post:
 *     summary: Record member attendance
 *     tags: [Attendances]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - memberId
 *               - classId
 *               - lessonId
 *               - date
 *               - status
 *             properties:
 *               memberId:
 *                 type: string
 *                 example: 65abc1234567890123456789
 *               classId:
 *                 type: string
 *                 example: 65def1234567890123456789
 *               lessonId:
 *                 type: string
 *                 example: 65ghi1234567890123456789
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2026-09-25"
 *               status:
 *                 type: string
 *                 enum:
 *                   - PRESENT
 *                   - ABSENT
 *                 example: PRESENT
 *     responses:
 *       201:
 *         description: Attendance recorded successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Member, Class or Lesson not found
 *       409:
 *         description: Attendance already recorded
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware(
    "CENTER_MANAGER",
    "COACH",
    "RECEPTIONIST"
  ),
  createAttendance
);

module.exports = router;