const express = require("express");

const {
  createPayment,
  getPayments,
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

module.exports = router;