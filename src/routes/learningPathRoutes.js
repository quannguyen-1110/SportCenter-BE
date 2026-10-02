const express = require("express");

const {
  createLearningPath,
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

module.exports = router;