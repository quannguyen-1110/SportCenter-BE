const express = require("express");

const {
  createSchedule,
  getSchedules,
  updateSchedule,
  deleteSchedule,
} = require("../controllers/scheduleController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/schedules:
 *   post:
 *     summary: Create a schedule
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
 *               date:
 *                 type: string
 *                 format: date
 *                 example: 2026-10-01
 *               startTime:
 *                 type: string
 *                 example: "08:00"
 *               endTime:
 *                 type: string
 *                 example: "10:00"
 *               status:
 *                 type: string
 *                 enum:
 *                   - SCHEDULED
 *                   - COMPLETED
 *                   - CANCELLED
 *                 example: SCHEDULED
 *     responses:
 *       201:
 *         description: Schedule created successfully
 *       400:
 *         description: Required fields are missing
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
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
router.get(
  "/",
  authMiddleware,
  getSchedules
);

/**
 * @swagger
 * /api/schedules/{id}:
 *   put:
 *     summary: Update a schedule
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
 *               date:
 *                 type: string
 *                 format: date
 *                 example: 2026-10-01
 *               startTime:
 *                 type: string
 *                 example: "08:00"
 *               endTime:
 *                 type: string
 *                 example: "10:00"
 *               status:
 *                 type: string
 *                 enum:
 *                   - SCHEDULED
 *                   - COMPLETED
 *                   - CANCELLED
 *                 example: SCHEDULED
 *     responses:
 *       200:
 *         description: Schedule updated successfully
 *       400:
 *         description: Required fields are missing
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Schedule not found
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