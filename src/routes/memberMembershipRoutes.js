const express = require("express");

const {
  createMemberMembership,
} = require("../controllers/memberMembershipController");

const router = express.Router();

/**
 * @swagger
 * /api/member-memberships:
 *   post:
 *     summary: Create a membership for a member
 *     tags: [Member Memberships]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - memberId
 *               - packageId
 *               - startDate
 *             properties:
 *               memberId:
 *                 type: string
 *                 example: 65abc1234567890123456789
 *               packageId:
 *                 type: string
 *                 example: 65def1234567890123456789
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-09-25"
 *     responses:
 *       201:
 *         description: Member membership created successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Member or membership package not found
 */
router.post("/", createMemberMembership);

module.exports = router;