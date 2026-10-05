const express = require("express");

const {
  createPayment,
  getPayments,
  updatePayment,
} = require("../controllers/paymentController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Get all payments
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payments retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get(
  "/",
  authMiddleware,
  getPayments
);

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Create a payment for a class registration
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - classRegistrationId
 *               - amount
 *               - paymentMethod
 *             properties:
 *               classRegistrationId:
 *                 type: string
 *                 example: 65abc1234567890123456789
 *               amount:
 *                 type: number
 *                 example: 500000
 *               paymentMethod:
 *                 type: string
 *                 enum:
 *                   - CASH
 *                   - BANK_TRANSFER
 *                   - ONLINE
 *                 example: BANK_TRANSFER
 *               status:
 *                 type: string
 *                 enum:
 *                   - PENDING
 *                   - SUCCESS
 *                   - FAILED
 *                 example: SUCCESS
 *               paymentDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2026-10-05T10:00:00.000Z
 *     responses:
 *       201:
 *         description: Payment created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Class registration not found
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware(
    "MEMBER",
    "RECEPTIONIST",
    "CENTER_MANAGER"
  ),
  createPayment
);

/**
 * @swagger
 * /api/payments/{id}:
 *   put:
 *     summary: Update a payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - classRegistrationId
 *               - amount
 *               - paymentMethod
 *             properties:
 *               classRegistrationId:
 *                 type: string
 *                 example: 65abc1234567890123456789
 *               amount:
 *                 type: number
 *                 example: 500000
 *               paymentMethod:
 *                 type: string
 *                 enum:
 *                   - CASH
 *                   - BANK_TRANSFER
 *                   - ONLINE
 *                 example: BANK_TRANSFER
 *               status:
 *                 type: string
 *                 enum:
 *                   - PENDING
 *                   - SUCCESS
 *                   - FAILED
 *                 example: SUCCESS
 *               paymentDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2026-10-05T10:00:00.000Z
 *     responses:
 *       200:
 *         description: Payment updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Payment or Class registration not found
 */
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(
    "MEMBER",
    "RECEPTIONIST",
    "CENTER_MANAGER"
  ),
  updatePayment
);

module.exports = router;