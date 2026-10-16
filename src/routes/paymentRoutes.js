const express = require("express");

const {
  createPayment,
  getPayments,
  updatePayment,
  simulatePaymentResult,
  createVnpayPaymentUrl,
  vnpayReturn,
  vnpayIpn,
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
router.get("/", authMiddleware, getPayments);

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
 *               - paymentMethod
 *             properties:
 *               classRegistrationId:
 *                 type: string
 *                 example: 65abc1234567890123456789
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, BANK_TRANSFER, ONLINE]
 *                 example: ONLINE
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
 *         description: Registration, class or course not found
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("MEMBER", "RECEPTIONIST", "CENTER_MANAGER"),
  createPayment
);

/**
 * @swagger
 * /api/payments/{id}:
 *   put:
 *     summary: Update a pending payment
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
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 500000
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, BANK_TRANSFER, ONLINE]
 *                 example: ONLINE
 *     responses:
 *       200:
 *         description: Payment updated successfully
 *       400:
 *         description: Invalid input or payment cannot be updated
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Payment or registration not found
 */
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("MEMBER", "RECEPTIONIST", "CENTER_MANAGER"),
  updatePayment
);

/**
 * @swagger
 * /api/payments/{id}/simulate:
 *   post:
 *     summary: Simulate a mock payment result (demo only)
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [SUCCESS, FAILED]
 *                 example: SUCCESS
 *     responses:
 *       200:
 *         description: Mock payment result simulated
 *       400:
 *         description: Invalid status or payment cannot be simulated
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Mock mode is disabled
 *       404:
 *         description: Payment not found
 */
router.post(
  "/:id/simulate",
  authMiddleware,
  roleMiddleware("MEMBER"),
  simulatePaymentResult
);

/**
 * @swagger
 * /api/payments/{id}/vnpay:
 *   post:
 *     summary: Create a VNPay Sandbox payment URL
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
 *     responses:
 *       200:
 *         description: VNPay payment URL created successfully
 *       400:
 *         description: Payment is not eligible for VNPay
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied or VNPay disabled
 *       404:
 *         description: Payment or registration not found
 */
router.post(
  "/:id/vnpay",
  authMiddleware,
  roleMiddleware("MEMBER"),
  createVnpayPaymentUrl
);

// VNPay redirects the customer's browser here after payment.
router.get("/vnpay-return", vnpayReturn);

// VNPay calls this endpoint server-to-server.
// Do not add authMiddleware to this route.
router.get("/vnpay-ipn", vnpayIpn);

module.exports = router;