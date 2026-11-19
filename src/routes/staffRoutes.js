const express = require("express");
const router = express.Router();

const {
  createStaffAccount,
  getRoles,
  listAccounts,
  updateAccountAccess,
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

/**
 * @swagger
 * /api/staff/roles:
 *   get:
 *     summary: List roles and what each role may do
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Role permission matrix
 */
router.get("/roles", authMiddleware, roleMiddleware("CENTER_MANAGER"), getRoles);

/**
 * @swagger
 * /api/staff/accounts:
 *   get:
 *     summary: List staff accounts (or accounts of one role)
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [CENTER_MANAGER, COACH, RECEPTIONIST, MEMBER] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, INACTIVE] }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Accounts
 */
router.get("/accounts", authMiddleware, roleMiddleware("CENTER_MANAGER"), listAccounts);

/**
 * @swagger
 * /api/staff/accounts/{id}:
 *   patch:
 *     summary: Change a staff role or lock/unlock an account
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role: { type: string, enum: [CENTER_MANAGER, COACH, RECEPTIONIST] }
 *               status: { type: string, enum: [ACTIVE, INACTIVE] }
 *               subjectId: { type: string, description: Required when becoming COACH without a coach profile }
 *     responses:
 *       200:
 *         description: Updated
 *       409:
 *         description: Change not allowed
 */
router.patch("/accounts/:id", authMiddleware, roleMiddleware("CENTER_MANAGER"), updateAccountAccess);

router.put("/accounts/:id", authMiddleware, roleMiddleware("CENTER_MANAGER"), require("../controllers/staffController").updateStaffAccount);

module.exports = router;
