const express = require("express");

const {
  createAttendance,
} = require("../controllers/attendanceController");

const router = express.Router();

/**
 * @swagger
 * /api/attendances:
 *   post:
 *     summary: Record member attendance
 *     tags: [Attendances]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - memberId
 *               - classId
 *               - date
 *             properties:
 *               memberId:
 *                 type: string
 *                 example: 65abc1234567890123456789
 *               classId:
 *                 type: string
 *                 example: 65def1234567890123456789
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2026-09-25"
 *     responses:
 *       201:
 *         description: Attendance recorded successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Member or Class not found
 *       409:
 *         description: Attendance already recorded
 */
router.post("/", createAttendance);

module.exports = router;