const express = require("express");

const {
  createSupportRequest,
  getSupportRequests,
  updateSupportRequest,
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

/**
 * @swagger
 * /api/support-requests/{id}:
 *   put:
 *     summary: Update support request status
 *     tags: [Support Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 65abc1234567890123456789
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
 *                 enum:
 *                   - PENDING
 *                   - RESOLVED
 *                 example: RESOLVED
 *     responses:
 *       200:
 *         description: Support request updated successfully
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
  "/:id",
  authMiddleware,
  roleMiddleware(
    "CENTER_MANAGER",
    "RECEPTIONIST"
  ),
  updateSupportRequest
);

module.exports = router;