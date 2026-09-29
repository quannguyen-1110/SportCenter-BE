const express = require("express");

const {
  createAttendance,
} = require("../controllers/attendanceController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

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
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Member or Class not found
 *       409:
 *         description: Attendance already recorded
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER", "COACH", "RECEPTIONIST"),
  createAttendance
);

module.exports = router;