const express = require("express");
const authenticate = require("../middlewares/authMiddleware");
const allow = require("../middlewares/roleMiddleware");
const { listOrders, createOrder, checkout, getStatus } = require("../controllers/membershipOrderController");

const router = express.Router();
router.use(authenticate, allow("MEMBER"));

/**
 * @swagger
 * /api/membership-orders:
 *   servers:
 *     - url: /
 *   get:
 *     tags: [Membership orders]
 *     summary: List the current member's 50 most recent orders
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Membership order history
 *   post:
 *     tags: [Membership orders]
 *     summary: Create or reuse a pending purchase or renewal
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planId]
 *             properties:
 *               planId: { type: string }
 *     responses:
 *       200:
 *         description: Pending order with the price determined by the server
 *       404:
 *         description: Member or plan not found
 */
router.get("/", listOrders);
router.post("/", createOrder);

/**
 * @swagger
 * /api/membership-orders/{id}/checkout:
 *   servers:
 *     - url: /
 *   post:
 *     tags: [Membership orders]
 *     summary: Open or resume PayOS checkout for an order
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order and paymentUrl
 *       409:
 *         description: Order already processed
 */
router.post("/:id/checkout", checkout);

/**
 * @swagger
 * /api/membership-orders/{id}/status:
 *   servers:
 *     - url: /
 *   get:
 *     tags: [Membership orders]
 *     summary: Refresh a membership order after checkout
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: PENDING, SUCCESS or FAILED, with membershipId on success
 *       404:
 *         description: Order not found for this member
 */
router.get("/:id/status", getStatus);

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error("Membership order request failed:", error.name);
  return res.status(500).json({ success: false, message: "Chưa xử lý được đơn gói." });
});

module.exports = router;
