const express = require("express");

const {
  createSupportRequest,
} = require("../controllers/supportRequestController");

const router = express.Router();

/**
 * @swagger
 * /api/support-requests:
 *   post:
 *     summary: Create a support request
 *     tags: [Support Requests]
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
 *       404:
 *         description: Member not found
 */
router.post("/", createSupportRequest);

module.exports = router;