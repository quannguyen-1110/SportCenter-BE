const express = require("express");

const {
  registerClass,
} = require("../controllers/classRegistrationController");

const router = express.Router();

/**
 * @swagger
 * /api/class-registrations:
 *   post:
 *     summary: Register a member for a class
 *     tags: [Class Registrations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - classId
 *               - memberId
 *             properties:
 *               classId:
 *                 type: string
 *                 example: 65abc1234567890123456789
 *               memberId:
 *                 type: string
 *                 example: 65def1234567890123456789
 *     responses:
 *       201:
 *         description: Class registration successful
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Class or Member not found
 *       409:
 *         description: Member is already registered
 */
router.post("/", registerClass);

module.exports = router;