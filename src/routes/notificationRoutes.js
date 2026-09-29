const express = require("express");

const {
  createNotification,
} = require("../controllers/notificationController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: Create a notification
 *     tags: [Notifications]
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
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: User not found
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER", "COACH", "RECEPTIONIST"),
  createNotification
);

module.exports = router;