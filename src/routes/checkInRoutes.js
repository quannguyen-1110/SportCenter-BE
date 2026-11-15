const express = require("express");

const authenticate = require("../middlewares/authMiddleware");
const allow = require("../middlewares/roleMiddleware");
const {
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  activateMembership,
  getMemberMembershipStatus,
  issueToken,
  confirmCheckIn,
  listMyMemberships,
} = require("../controllers/checkInController");

const router = express.Router();
router.use(authenticate);

/**
 * @swagger
 * /api/check-ins/plans:
 *   servers:
 *     - url: /
 *   get:
 *     tags: [Check-ins]
 *     summary: List membership plans
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available plans
 *   post:
 *     tags: [Check-ins]
 *     summary: Create a membership plan as a center manager
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name, durationDays, priceVnd]
 *             properties:
 *               code: { type: string, example: GYM30 }
 *               name: { type: string, example: Gym 30 ngày }
 *               durationDays: { type: integer, example: 30 }
 *               priceVnd: { type: integer, example: 500000 }
 *     responses:
 *       201:
 *         description: Plan created
 *       409:
 *         description: Plan code already exists
 */
router.get("/plans", allow("CENTER_MANAGER", "RECEPTIONIST", "MEMBER"), listPlans);
router.post("/plans", allow("CENTER_MANAGER"), createPlan);

/**
 * @swagger
 * /api/check-ins/plans/{id}:
 *   servers:
 *     - url: /
 *   put:
 *     tags: [Check-ins]
 *     summary: Update a membership plan (name, description, durationDays, priceVnd, isActive)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Plan updated
 *   delete:
 *     tags: [Check-ins]
 *     summary: Delete an unused plan, or retire a plan that has sales history
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Plan deleted or retired
 */
router.put("/plans/:id", allow("CENTER_MANAGER"), updatePlan);
router.delete("/plans/:id", allow("CENTER_MANAGER"), deletePlan);

/**
 * @swagger
 * /api/check-ins/memberships/member/{memberId}:
 *   servers:
 *     - url: /
 *   get:
 *     tags: [Check-ins]
 *     summary: Check a member's membership status and expiry at the front desk
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: memberId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: ACTIVE, EXPIRING_SOON, EXPIRED or NONE with membership history
 */
router.get("/memberships/member/:memberId", allow("CENTER_MANAGER", "RECEPTIONIST"), getMemberMembershipStatus);

/**
 * @swagger
 * /api/check-ins/memberships:
 *   servers:
 *     - url: /
 *   post:
 *     tags: [Check-ins]
 *     summary: Activate a plan for a member at the front desk
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [memberId, planId]
 *             properties:
 *               memberId: { type: string }
 *               planId: { type: string }
 *     responses:
 *       201:
 *         description: Membership activated
 *       404:
 *         description: Member or plan not found
 */
router.post("/memberships", allow("CENTER_MANAGER", "RECEPTIONIST"), activateMembership);

/**
 * @swagger
 * /api/check-ins/memberships/me:
 *   servers:
 *     - url: /
 *   get:
 *     tags: [Check-ins]
 *     summary: List memberships for the signed-in member
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Membership history for this member
 *       404:
 *         description: Member profile not found
 */
router.get("/memberships/me", allow("MEMBER"), listMyMemberships);

/**
 * @swagger
 * /api/check-ins/tokens:
 *   servers:
 *     - url: /
 *   post:
 *     tags: [Check-ins]
 *     summary: Issue a single-use entry QR code for the authenticated member
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: PNG data URL and QR expiration time
 *       403:
 *         description: Active membership required
 */
router.post("/tokens", allow("MEMBER"), issueToken);

/**
 * @swagger
 * /api/check-ins:
 *   servers:
 *     - url: /
 *   post:
 *     tags: [Check-ins]
 *     summary: Confirm gate entry from a scanned QR code
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string, description: Raw text scanned from the QR image }
 *     responses:
 *       201:
 *         description: Check-in recorded
 *       403:
 *         description: Staff role or active membership required
 *       409:
 *         description: QR code invalid, expired or used
 */
router.post("/", allow("CENTER_MANAGER", "RECEPTIONIST"), confirmCheckIn);

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.code === 11000 && error.keyPattern?.code) {
    return res.status(409).json({ success: false, message: "Plan code already exists" });
  }
  if (error.status === 403) {
    return res.status(403).json({ success: false, message: error.message });
  }
  console.error("Check-in request failed:", error.name);
  return res.status(500).json({ success: false, message: "Check-in request failed" });
});

module.exports = router;
