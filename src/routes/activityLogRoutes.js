const express = require("express");

const {
  createActivityLog,
} = require("../controllers/activityLogController");

const router = express.Router();

/**
 * @swagger
 * /api/activity-logs:
 *   post:
 *     summary: Create an activity log
 *     tags: [Activity Logs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - action
 *             properties:
 *               userId:
 *                 type: string
 *                 example: 65abc1234567890123456789
 *               action:
 *                 type: string
 *                 example: Created a new member
 *     responses:
 *       201:
 *         description: Activity log created successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: User not found
 */
router.post("/", createActivityLog);

module.exports = router;