const express = require("express");

const {
  createSupportRequest,
  getSupportRequests,
} = require("../controllers/supportRequestController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/support-requests:
 *   get:
 *     summary: Get all support requests
 *     tags: [Support Requests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Support requests retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get(
  "/",
  authMiddleware,
  getSupportRequests
);

/**
 * @swagger
 * /api/support-requests:
 *   post:
 *     summary: Create a support request
 *     tags: [Support Requests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - memberId
 *               - message
 *             properties:
 *               memberId:
 *                 type: string
 *                 example: 65abc1234567890123456789
 *               message:
 *                 type: string
 *                 example: Tôi muốn đổi lịch học sang buổi tối.
 *     responses:
 *       201:
 *         description: Support request created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Member not found
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("MEMBER"),
  createSupportRequest
);

module.exports = router;