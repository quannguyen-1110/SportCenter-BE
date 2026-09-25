const express = require("express");

const { createMember } = require("../controllers/memberController");

const router = express.Router();

/**
 * @swagger
 * /api/members:
 *   post:
 *     summary: Create a member profile
 *     tags: [Members]
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
 *                 example: 6ab6878512d539c14ac93547
 *               fullName:
 *                 type: string
 *                 example: Nguyen Van A
 *               phone:
 *                 type: string
 *                 example: "0901234567"
 *     responses:
 *       201:
 *         description: Member created successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: User not found
 *       409:
 *         description: Member profile already exists
 */
router.post("/", createMember);

module.exports = router;