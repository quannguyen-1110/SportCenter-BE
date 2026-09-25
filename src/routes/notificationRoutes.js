const express = require("express");

const {
  createNotification,
} = require("../controllers/notificationController");

const router = express.Router();

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: Create a notification
 *     tags: [Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - title
 *               - message
 *             properties:
 *               userId:
 *                 type: string
 *                 example: 65abc1234567890123456789
 *               title:
 *                 type: string
 *                 example: Lịch tập hôm nay
 *               message:
 *                 type: string
 *                 example: Bạn có lớp Football lúc 18:00 hôm nay.
 *     responses:
 *       201:
 *         description: Notification created successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: User not found
 */
router.post("/", createNotification);

module.exports = router;