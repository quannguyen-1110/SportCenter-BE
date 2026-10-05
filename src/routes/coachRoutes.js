const express = require("express");

const {
  createCoach,
  getCoaches,
} = require("../controllers/coachController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/coaches:
 *   get:
 *     summary: Get all coaches
 *     tags: [Coaches]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Coaches retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get(
  "/",
  authMiddleware,
  getCoaches
);

/**
 * @swagger
 * /api/coaches:
 *   post:
 *     summary: Create a coach profile
 *     tags: [Coaches]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - fullName
 *               - phone
 *             properties:
 *               userId:
 *                 type: string
 *                 example: 65abc1234567890123456789
 *               fullName:
 *                 type: string
 *                 example: Nguyen Van B
 *               phone:
 *                 type: string
 *                 example: "0901234567"
 *     responses:
 *       201:
 *         description: Coach created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: User not found
 *       409:
 *         description: Coach profile already exists
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  createCoach
);

module.exports = router;