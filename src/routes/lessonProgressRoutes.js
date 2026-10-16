
const express = require("express");

const {
  createLessonProgress,
  getLessonProgress,
  updateLessonProgress,
} = require("../controllers/lessonProgressController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/lesson-progress:
 *   get:
 *     summary: Get lesson progress based on user role
 *     tags: [Lesson Progress]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lesson progress retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 */
router.get("/", authMiddleware, getLessonProgress);

/**
 * @swagger
 * /api/lesson-progress:
 *   post:
 *     summary: Create lesson progress
 *     tags: [Lesson Progress]
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
 *               - lessonId
 *               - classId
 *             properties:
 *               memberId:
 *                 type: string
 *                 example: 67abc1234567890123456789
 *               lessonId:
 *                 type: string
 *                 example: 67def1234567890123456789
 *               classId:
 *                 type: string
 *                 example: 67fed1234567890123456789
 *               status:
 *                 type: string
 *                 enum: [NOT_STARTED, IN_PROGRESS, COMPLETED]
 *                 example: IN_PROGRESS
 *     responses:
 *       201:
 *         description: Lesson progress created successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Member, lesson, or class not found
 *       409:
 *         description: Lesson progress already exists
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("MEMBER", "COACH", "CENTER_MANAGER"),
  createLessonProgress
);

/**
 * @swagger
 * /api/lesson-progress/{id}:
 *   put:
 *     summary: Update lesson progress or coach evaluation
 *     tags: [Lesson Progress]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lesson progress ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [NOT_STARTED, IN_PROGRESS, COMPLETED]
 *                 example: COMPLETED
 *               coachComment:
 *                 type: string
 *                 example: Student has improved their technique and consistency.
 *     responses:
 *       200:
 *         description: Lesson progress updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Lesson progress not found
 */
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("MEMBER", "COACH", "CENTER_MANAGER"),
  updateLessonProgress
);

module.exports = router;
