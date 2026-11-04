const express = require("express");
const router = express.Router();

const {
  createStaffAccount,
} = require("../controllers/staffController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * /api/staff/accounts:
 *   post:
 *     summary: Create a Coach or Receptionist account
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     description: Only CENTER_MANAGER can create COACH or RECEPTIONIST accounts.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - role
 *               - fullName
 *               - phone
 *             properties:
 *               email:
 *                 type: string
 *                 example: coach@example.com
 *               password:
 *                 type: string
 *                 example: 123456
 *               role:
 *                 type: string
 *                 enum: [COACH, RECEPTIONIST]
 *                 example: COACH
 *               fullName:
 *                 type: string
 *                 example: Nguyen Van A
 *               phone:
 *                 type: string
 *                 example: "0901234567"
 *               subjectId:
 *                 type: string
 *                 description: Required when role is COACH
 *                 example: 65f123456789abcdef123456
 *     responses:
 *       201:
 *         description: Staff account created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only CENTER_MANAGER can create staff accounts
 *       409:
 *         description: Email already exists
 *       500:
 *         description: Server error
 */
router.post(
  "/accounts",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  createStaffAccount
);

module.exports = router;