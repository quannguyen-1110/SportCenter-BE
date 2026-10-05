const express = require("express");

const {
  createLearningPath,
  getLearningPaths,
  updateLearningPath,
  deleteLearningPath,
} = require("../controllers/learningPathController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/learning-paths:
 *   post:
 *     summary: Create a learning path
 *     tags: [Learning Paths]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - courseId
 *               - name
 *             properties:
 *               courseId:
 *                 type: string
 *                 example: 67abc1234567890123456789
 *               name:
 *                 type: string
 *                 example: Weight Loss
 *               description:
 *                 type: string
 *                 example: Learning path for members who want to lose weight
 *     responses:
 *       201:
 *         description: Learning path created successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Course not found
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  createLearningPath
);

/**
 * @swagger
 * /api/learning-paths:
 *   get:
 *     summary: Get all learning paths
 *     tags: [Learning Paths]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Learning paths retrieved successfully
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.get(
  "/",
  authMiddleware,
  getLearningPaths
);

/**
 * @swagger
 * /api/learning-paths/{id}:
 *   put:
 *     summary: Update a learning path
 *     tags: [Learning Paths]
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
 *               courseId:
 *                 type: string
 *                 example: 67abc1234567890123456789
 *               name:
 *                 type: string
 *                 example: Yoga Flexibility
 *               description:
 *                 type: string
 *                 example: Learning path for improving flexibility
 *     responses:
 *       200:
 *         description: Learning path updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Learning path or course not found
 *       500:
 *         description: Internal server error
 */
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  updateLearningPath
);

/**
 * @swagger
 * /api/learning-paths/{id}:
 *   delete:
 *     summary: Delete a learning path
 *     tags: [Learning Paths]
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
 *         description: Learning path deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Learning path not found
 *       409:
 *         description: Learning path is being used by a lesson
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  deleteLearningPath
);

module.exports = router;