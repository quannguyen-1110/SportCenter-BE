const express = require("express");

const {
  createSupportRequest,
  getSupportRequests,
  updateSupportRequestStatus,
} = require("../controllers/supportRequestController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/support-requests:
 *   post:
 *     summary: Submit or log a support request
 *     description: >
 *       MEMBER submits their own request.
 *       RECEPTIONIST and CENTER_MANAGER can log a request
 *       for a specific member.
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
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 example: I need help changing my class schedule.
 *               memberId:
 *                 type: string
 *                 description: Required for staff users
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
 *         description: Member profile not found
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("MEMBER", "RECEPTIONIST", "CENTER_MANAGER"),
  createSupportRequest
);

/**
 * @swagger
 * /api/support-requests:
 *   get:
 *     summary: Get support requests
 *     description: >
 *       Members can see only their own requests.
 *       Receptionists and managers can see requests across the center.
 *     tags: [Support Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, RESOLVED]
 *         description: Optional status filter for staff users
 *     responses:
 *       200:
 *         description: Support requests retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get(
  "/",
  authMiddleware,
  roleMiddleware("MEMBER", "RECEPTIONIST", "CENTER_MANAGER"),
  getSupportRequests
);

/**
 * @swagger
 * /api/support-requests/{id}/status:
 *   put:
 *     summary: Update support request status
 *     description: "Access: RECEPTIONIST, CENTER_MANAGER."
 *     tags: [Support Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, RESOLVED]
 *                 example: RESOLVED
 *     responses:
 *       200:
 *         description: Support request status updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Support request not found
 */
router.put(
  "/:id/status",
  authMiddleware,
  roleMiddleware("RECEPTIONIST", "CENTER_MANAGER"),
  updateSupportRequestStatus
);

module.exports = router;