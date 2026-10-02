const express = require("express");

const {
  createLessonProgress,
} = require("../controllers/lessonProgressController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

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
 *             properties:
 *               memberId:
 *                 type: string
 *                 example: 67abc1234567890123456789
 *               lessonId:
 *                 type: string
 *                 example: 67def1234567890123456789
 *               status:
 *                 type: string
 *                 enum:
 *                   - NOT_STARTED
 *                   - IN_PROGRESS
 *                   - COMPLETED
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
 *         description: Member or lesson not found
 *       409:
 *         description: Lesson progress already exists
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("MEMBER", "COACH", "CENTER_MANAGER"),
  createLessonProgress
);

module.exports = router;