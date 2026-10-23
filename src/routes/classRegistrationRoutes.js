
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
 *     summary: Update or cancel a class registration
 *     description: >
 *       Access: MEMBER, RECEPTIONIST, CENTER_MANAGER.
 *       Members can only cancel their own registrations.
 *       Staff can manage registrations. A paid registration cannot
 *       be cancelled until the refund process is handled.
 *     tags: [Class Registrations]
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
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING_PAYMENT, CONFIRMED, CANCELLED]
 *                 example: CANCELLED
 *               classId:
 *                 type: string
 *               memberId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Registration updated successfully
 *       400:
 *         description: Invalid input or payment required
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Registration, class or member not found
 *       409:
 *         description: Duplicate registration, capacity conflict or payment restriction
 */
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("MEMBER", "RECEPTIONIST", "CENTER_MANAGER"),
  updateClassRegistration
);

module.exports = router;
