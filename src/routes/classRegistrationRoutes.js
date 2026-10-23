
const express = require("express");

const {
  registerClass,
  getClassRegistrations,
  updateClassRegistration,
} = require("../controllers/classRegistrationController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/class-registrations:
 *   get:
 *     summary: Get all class registrations
 *     description: Access CENTER_MANAGER and RECEPTIONIST only.
 *     tags: [Class Registrations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Class registrations retrieved successfully
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
  getClassRegistrations
);

/**
 * @swagger
 * /api/class-registrations:
 *   post:
 *     summary: Register a member for a class
 *     description: |
 *       Access: MEMBER, RECEPTIONIST, CENTER_MANAGER.
 *
 *       Members can register themselves. Receptionists and center
 *       managers can register a member by providing memberId.
 *       New registrations start with PENDING_PAYMENT.
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
 *             properties:
 *               classId:
 *                 type: string
 *                 example: 65abc1234567890123456789
 *               memberId:
 *                 type: string
 *                 description: Required for RECEPTIONIST and CENTER_MANAGER; optional for MEMBER registering themselves.
 *                 example: 65def1234567890123456789
 *     responses:
 *       201:
 *         description: Class registration created with PENDING_PAYMENT status
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
 *       500:
 *         description: Internal server error
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

/**
 * @swagger
 * /api/class-registrations/{id}:
 *   put:
 *     summary: Update a class registration
 *     description: |
 *       Access: MEMBER, RECEPTIONIST, CENTER_MANAGER.
 *
 *       MEMBER can only cancel their own registration and cannot
 *       directly confirm it.
 *
 *       RECEPTIONIST and CENTER_MANAGER may update registration
 *       details. Setting status to CONFIRMED requires a successful
 *       payment recorded for this registration.
 *
 *       classId and memberId may be omitted when not being changed.
 *     tags: [Class Registrations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Class registration ID
 *         schema:
 *           type: string
 *         example: 65abc1234567890123456789
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               classId:
 *                 type: string
 *                 example: 65abc1234567890123456789
 *               memberId:
 *                 type: string
 *                 example: 65def1234567890123456789
 *               status:
 *                 type: string
 *                 enum:
 *                   - PENDING_PAYMENT
 *                   - CONFIRMED
 *                   - CANCELLED
 *                 example: CANCELLED
 *     responses:
 *       200:
 *         description: Class registration updated successfully
 *       400:
 *         description: Invalid input or successful payment required
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied or Member attempted a forbidden change
 *       404:
 *         description: Registration, Class, or Member not found
 *       409:
 *         description: Duplicate registration or payment already exists
 *       500:
 *         description: Internal server error
 */
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(
    "MEMBER",
    "RECEPTIONIST",
    "CENTER_MANAGER"
  ),
  updateClassRegistration
);

module.exports = router;
