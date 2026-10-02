const express = require("express");

const {
  createLesson,
} = require("../controllers/lessonController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/lessons:
 *   post:
 *     summary: Create a lesson
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - learningPathId
 *               - title
 *               - order
 *             properties:
 *               learningPathId:
 *                 type: string
 *                 example: 67abc1234567890123456789
 *               title:
 *                 type: string
 *                 example: Introduction to Yoga
 *               description:
 *                 type: string
 *                 example: Basic yoga movements and breathing techniques
 *               order:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Lesson created successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Learning path not found
 *       409:
 *         description: Lesson order already exists
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  createLesson
);

module.exports = router;