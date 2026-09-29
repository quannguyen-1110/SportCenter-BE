const express = require("express");

const {
  createClass,
} = require("../controllers/classController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/classes:
 *   post:
 *     summary: Create a class
 *     tags: [Classes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - subjectId
 *               - coachId
 *             properties:
 *               name:
 *                 type: string
 *                 example: Football Beginner
 *               subjectId:
 *                 type: string
 *                 example: 65abc1234567890123456789
 *               coachId:
 *                 type: string
 *                 example: 65def1234567890123456789
 *     responses:
 *       201:
 *         description: Class created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Subject or Coach not found
 *       409:
 *         description: Coach is already assigned to another class
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  createClass
);

module.exports = router;