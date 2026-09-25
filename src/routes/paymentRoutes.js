const express = require("express");

const {
  createPayment,
} = require("../controllers/paymentController");

const router = express.Router();

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Create a payment
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - memberMembershipId
 *               - amount
 *               - paymentDate
 *             properties:
 *               memberMembershipId:
 *                 type: string
 *                 example: 65abc1234567890123456789
 *               amount:
 *                 type: number
 *                 example: 1500000
 *               paymentDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-09-25"
 *     responses:
 *       201:
 *         description: Payment created successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Member membership not found
 */
router.post("/", createPayment);

module.exports = router;
