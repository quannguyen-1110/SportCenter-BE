
const express = require("express");

const {
  createPayment,
  getPayments,
  updatePayment,
  simulatePaymentResult,
  createVnpayPaymentUrl,
  vnpayReturn,
  vnpayIpn,
  recordOfflinePayment,
  getPaymentReceipt,
  getPaymentStatusById,
} = require("../controllers/paymentController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Get all payments
 *     description: Only RECEPTIONIST and CENTER_MANAGER can retrieve all payments.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payments retrieved successfully
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
  roleMiddleware("RECEPTIONIST", "CENTER_MANAGER"),
  getPayments
);

/**
 * @swagger
 * /api/payments/{id}/status:
 *   get:
 *     summary: Get payment status by ID
 *     description: |
 *       MEMBER can only check their own payment.
 *       RECEPTIONIST and CENTER_MANAGER can check payments by ID.
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
 *         example: 67abc1234567890123456789
 *     responses:
 *       200:
 *         description: Payment status retrieved successfully
 *       400:
 *         description: Invalid payment ID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Payment or class registration not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/:id/status",
  authMiddleware,
  roleMiddleware("MEMBER", "RECEPTIONIST", "CENTER_MANAGER"),
  getPaymentStatusById
);

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Create a payment for a class registration
 *     description: |
 *       The payment amount is calculated by the backend
 *       using ClassRegistration.priceSnapshot.
 *       MEMBER can only create payment for their own registration.
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
 *         description: Invalid input or registration cannot be paid
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Class registration not found
 *       409:
 *         description: A pending or successful payment already exists
 *       500:
 *         description: Internal server error
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
 *     description: |
 *       Only the payment method can be updated.
 *       Amount, payment status, payment date and registration
 *       association cannot be changed through this endpoint.
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
 *       500:
 *         description: Internal server error
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
 *     description: Only available when PAYMENT_MODE=mock.
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
 *         description: Mock mode is disabled or access denied
 *       404:
 *         description: Payment not found
 *       500:
 *         description: Internal server error
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
 *       500:
 *         description: Internal server error
 */
router.post(
  "/:id/vnpay",
  authMiddleware,
  roleMiddleware("MEMBER"),
  createVnpayPaymentUrl
);

// VNPay redirects the customer's browser here after payment.
// No authentication required.
router.get("/vnpay-return", vnpayReturn);

// VNPay calls this endpoint server-to-server.
// No authentication required.
router.get("/vnpay-ipn", vnpayIpn);

/**
 * @swagger
 * /api/payments/{id}/record-payment:
 *   post:
 *     summary: Record offline payment at the front desk
 *     description: Only RECEPTIONIST and CENTER_MANAGER can record offline payments.
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
 *         description: Payment recorded successfully
 *       400:
 *         description: Invalid payment or cancelled registration
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Payment or registration not found
 *       409:
 *         description: Payment cannot be recorded
 *       500:
 *         description: Internal server error
 */
router.post(
  "/:id/record-payment",
  authMiddleware,
  roleMiddleware("RECEPTIONIST", "CENTER_MANAGER"),
  recordOfflinePayment
);

/**
 * @swagger
 * /api/payments/{id}/receipt:
 *   get:
 *     summary: Get printable payment receipt
 *     description: |
 *       Only successful payments can produce a receipt.
 *       MEMBER can only access their own receipt.
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
 *         description: Printable payment receipt returned as HTML
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Payment or related registration data not found
 *       409:
 *         description: Receipt is only available for successful payments
 *       500:
 *         description: Internal server error
 */
router.get(
  "/:id/receipt",
  authMiddleware,
  roleMiddleware("MEMBER", "RECEPTIONIST", "CENTER_MANAGER"),
  getPaymentReceipt
);

module.exports = router;
