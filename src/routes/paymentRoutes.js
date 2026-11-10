
const express = require("express");

const {
  createPayment,
  createPayosPayment,
  getPayments,
  updatePayment,
  simulatePaymentResult,
  createVnpayPaymentUrl,
  vnpayReturn,
  verifyVnpayReturn,
  vnpayIpn,
  recordOfflinePayment,
  getPaymentReceipt,
  getPaymentStatusById,
} = require("../controllers/paymentController");
const { createPayosCheckout, payosWebhook } = require("../controllers/payosController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

router.post("/payos/webhook", payosWebhook);
router.get("/payos/return", (_req, res) => {
  res.type("text").send("Quay lại ActiveHub và bấm Kiểm tra trạng thái mới nhất.");
});
/**
 * @swagger
 * /api/payments/payos:
 *   post:
 *     summary: Create a Mobile payOS payment
 *     description: Requires classRegistrationId and paymentMethod ONLINE. Uses the registration priceSnapshot.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [classRegistrationId, paymentMethod]
 *             properties:
 *               classRegistrationId:
 *                 type: string
 *               paymentMethod:
 *                 type: string
 *                 enum: [ONLINE]
 *     responses:
 *       201:
 *         description: Mobile payOS payment created
 *       200:
 *         description: Existing pending payOS payment reused
 *       409:
 *         description: Registration cannot be paid or another provider is already pending
 * /api/payments/{id}/checkout:
 *   post:
 *     summary: Create or reuse a Mobile payOS checkout URL
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: payOS checkout URL created or reused
 *       404:
 *         description: Owned payOS payment not found
 */
// Mobile creates payOS payments here; Web keeps POST / and POST /:id/vnpay.
router.post("/payos", authMiddleware, roleMiddleware("MEMBER"), createPayosPayment);
router.post("/:id/checkout", authMiddleware, roleMiddleware("MEMBER"), createPayosCheckout);

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: List payments
 *     description: Members see their own payments. Receptionists and center managers see all payments.
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
  roleMiddleware("MEMBER", "RECEPTIONIST", "CENTER_MANAGER"),
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

/**
 * @swagger
 * /api/payments/vnpay/verify-return:
 *   post:
 *     summary: Verify a signed VNPay browser return for the logged-in member
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties:
 *               type: string
 *     responses:
 *       200:
 *         description: Verified payment and registration status
 *       400:
 *         description: Invalid response, signature or amount
 *       403:
 *         description: Payment belongs to another member
 */
router.post("/vnpay/verify-return", authMiddleware, roleMiddleware("MEMBER"), verifyVnpayReturn);

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
