
const express = require("express");

const {
  sendCoachNotification,
  markAllMyNotificationsRead,
  createNotification,
  getNotifications,
  getMyNotifications,
  updateNotification,
} = require("../controllers/notificationController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Notification management APIs
 */

/**
 * @swagger
 * /api/notifications/my:
 *   get:
 *     summary: Get notifications of the current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.get(
  "/my",
  authMiddleware,
  getMyNotifications
);

/**
 * @swagger
 * /api/notifications/my/read-all:
 *   put:
 *     summary: Mark all of your notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Number of notifications updated
 */
router.put(
  "/my/read-all",
  authMiddleware,
  markAllMyNotificationsRead
);

/**
 * @swagger
 * /api/notifications/coach:
 *   post:
 *     summary: Coach sends a notification to one of their classes or one student
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, message]
 *             properties:
 *               classId: { type: string, description: Send to all confirmed members of this class }
 *               memberId: { type: string, description: Send to a single student }
 *               title: { type: string, example: "Đổi bài tập tuần này" }
 *               message: { type: string, example: "Cả lớp tập thêm 3 hiệp plank mỗi tối." }
 *     responses:
 *       201:
 *         description: Notification sent
 *       403:
 *         description: Class or member is not yours
 */
router.post(
  "/coach",
  authMiddleware,
  roleMiddleware("COACH"),
  sendCoachNotification
);

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get all notifications (management only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       500:
 *         description: Internal server error
 */
router.get(
  "/",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER", "RECEPTIONIST"),
  getNotifications
);

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: Create a notification manually
 *     description: Restricted to CENTER_MANAGER and RECEPTIONIST.
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
 *                 example: "65abc1234567890123456789"
 *               title:
 *                 type: string
 *                 example: "Lịch tập hôm nay"
 *               message:
 *                 type: string
 *                 example: "Bạn có lớp Football lúc 18:00 hôm nay."
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
 *       500:
 *         description: Internal server error
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER", "RECEPTIONIST"),
  createNotification
);

/**
 * @swagger
 * /api/notifications/{id}:
 *   put:
 *     summary: Mark one of your notifications as read or unread
 *     description: Users can update only notifications belonging to their own account.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "65abc1234567890123456789"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isRead
 *             properties:
 *               isRead:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Notification updated successfully
 *       400:
 *         description: Invalid notification ID or isRead value
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Internal server error
 */
router.put(
  "/:id",
  authMiddleware,
  updateNotification
);

module.exports = router;
