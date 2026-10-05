const express = require("express");

const {
  registerClass,
  getClassRegistrations,
} = require("../controllers/classRegistrationController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/class-registrations:
 *   get:
 *     summary: Get all class registrations
 *     tags: [Class Registrations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Class registrations retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get(
  "/",
  authMiddleware,
  getClassRegistrations
);

/**
 * @swagger
 * /api/class-registrations:
 *   post:
 *     summary: Register a member for a class
 *     tags: [Class Registrations]
 *     security:
 *       - bearerAuth: []
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
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Class or Member not found
 *       409:
 *         description: Member is already registered
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware(
    "MEMBER",
    "RECEPTIONIST",
    "CENTER_MANAGER"
  ),
  registerClass
);

module.exports = router;