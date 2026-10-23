const express = require("express");

const {
  createLesson,
  getLessons,
  getLessonsByClass,
  updateLesson,
  deleteLesson,
} = require("../controllers/lessonController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/lessons:
 *   post:
 *     summary: Create a lesson for a class
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
 *               - classId
 *               - learningPathId
 *               - title
 *               - order
 *             properties:
 *               classId:
 *                 type: string
 *                 description: ID of the class this lesson belongs to
 *                 example: 67abc1234567890123456789
 *               learningPathId:
 *                 type: string
 *                 description: Learning path associated with the lesson
 *                 example: 67abc1234567890123456789
 *               title:
 *                 type: string
 *                 example: Introduction to Yoga
 *               description:
 *                 type: string
 *                 example: Basic yoga movements and breathing techniques
 *               order:
 *                 type: integer
 *                 minimum: 1
 *                 example: 1
 *     responses:
 *       201:
 *         description: Lesson created successfully
 *       400:
 *         description: Invalid request or learning path does not belong to the class course
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Class or learning path not found
 *       409:
 *         description: A lesson with this order already exists in the class
 *       500:
 *         description: Internal server error
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  createLesson
);

/**
 * @swagger
 * /api/lessons:
 *   get:
 *     summary: Get all lessons
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lessons retrieved successfully
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.get(
  "/",
  authMiddleware,
  getLessons
);
/**
 * @swagger
 * /api/lessons/class/{classId}:
 *   get:
 *     summary: Get all lessons belonging to a class
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *         example: 67abc1234567890123456789
 *     responses:
 *       200:
 *         description: Lessons retrieved successfully
 *       400:
 *         description: Invalid class ID
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Class not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/class/:classId",
  authMiddleware,
  getLessonsByClass
);
/**
 * @swagger
 * /api/lessons/{id}:
 *   put:
 *     summary: Update a lesson
 *     tags: [Lessons]
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
 *             properties:
 *               classId:
 *                 type: string
 *                 description: ID of the class this lesson belongs to
 *                 example: 67abc1234567890123456789
 *               learningPathId:
 *                 type: string
 *                 example: 67abc1234567890123456789
 *               title:
 *                 type: string
 *                 example: Advanced Yoga Techniques
 *               description:
 *                 type: string
 *                 example: Advanced yoga movements and breathing techniques
 *               order:
 *                 type: integer
 *                 minimum: 1
 *                 example: 2
 *     responses:
 *       200:
 *         description: Lesson updated successfully
 *       400:
 *         description: Invalid request or learning path does not belong to the class course
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Lesson, class or learning path not found
 *       409:
 *         description: Duplicate lesson order or lesson is used by a schedule
 *       500:
 *         description: Internal server error
 */
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  updateLesson
);

/**
 * @swagger
 * /api/lessons/{id}:
 *   delete:
 *     summary: Delete a lesson
 *     tags: [Lessons]
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
 *         description: Lesson deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Lesson not found
 *       409:
 *         description: Lesson is used by a schedule or has attendance records
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  deleteLesson
);

module.exports = router;