const express = require("express");

const {
  createMembershipPackage,
} = require("../controllers/membershipPackageController");

const router = express.Router();

/**
 * @swagger
 * /api/membership-packages:
 *   post:
 *     summary: Create a membership package
 *     tags: [Membership Packages]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *               - duration
 *             properties:
 *               name:
 *                 type: string
 *                 example: Gói 3 tháng
 *               price:
 *                 type: number
 *                 example: 1500000
 *               duration:
 *                 type: integer
 *                 example: 90
 *                 description: Duration in days
 *     responses:
 *       201:
 *         description: Membership package created successfully
 *       400:
 *         description: Invalid input
 */
router.post("/", createMembershipPackage);

module.exports = router;