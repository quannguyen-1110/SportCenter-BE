const express = require("express");

const {
  createMember,
  getMembers,
  updateMember,
  deleteMember,
  getMyProfile,
  createMyProfile,
  updateMyProfile,
} = require("../controllers/memberController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/members/me:
 *   get:
 *     summary: Get my member profile
 *     description: "Access: MEMBER"
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only members can access this endpoint
 *       404:
 *         description: Profile not found
 */
router.get(
  "/me",
  authMiddleware,
  roleMiddleware("MEMBER"),
  getMyProfile
);

/**
 * @swagger
 * /api/members/me:
 *   post:
 *     summary: Create my member profile
 *     description: "Access: MEMBER. userId is obtained from the JWT."
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - phone
 *               - goal
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: Nguyen Van A
 *               phone:
 *                 type: string
 *                 example: "0901234567"
 *               goal:
 *                 type: string
 *                 example: Weight loss
 *               level:
 *                 type: string
 *                 enum: [BEGINNER, INTERMEDIATE, ADVANCED]
 *                 example: BEGINNER
 *     responses:
 *       201:
 *         description: Profile created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only members can create their own profile
 *       409:
 *         description: Profile already exists
 */
router.post(
  "/me",
  authMiddleware,
  roleMiddleware("MEMBER"),
  createMyProfile
);

/**
 * @swagger
 * /api/members/me:
 *   put:
 *     summary: Update my member profile
 *     description: "Access: MEMBER. Only the current user's profile can be updated."
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               phone:
 *                 type: string
 *               goal:
 *                 type: string
 *               level:
 *                 type: string
 *                 enum: [BEGINNER, INTERMEDIATE, ADVANCED]
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only members can update their own profile
 *       404:
 *         description: Profile not found
 */
router.put(
  "/me",
  authMiddleware,
  roleMiddleware("MEMBER"),
  updateMyProfile
);

/**
 * @swagger
 * /api/members:
 *   get:
 *     summary: Get all members
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Members retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get(
  "/",
  authMiddleware,
  getMembers
);

/**
 * @swagger
 * /api/members:
 *   post:
 *     summary: Create a member profile
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - fullName
 *               - phone
 *             properties:
 *               userId:
 *                 type: string
 *                 example: 6ab6878512d539c14ac93547
 *               fullName:
 *                 type: string
 *                 example: Nguyen Van A
 *               phone:
 *                 type: string
 *                 example: "0901234567"
 *               goal:
 *                 type: string
 *                 example: Weight loss
 *               level:
 *                 type: string
 *                 enum: [BEGINNER, INTERMEDIATE, ADVANCED]
 *                 example: BEGINNER
 *     responses:
 *       201:
 *         description: Member created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: User not found
 *       409:
 *         description: Member profile already exists
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER", "RECEPTIONIST"),
  createMember
);

/**
 * @swagger
 * /api/members/{id}:
 *   put:
 *     summary: Update a member profile
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 6ab6878512d539c14ac93547
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - phone
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: Nguyen Van B
 *               phone:
 *                 type: string
 *                 example: "0912345678"
 *               goal:
 *                 type: string
 *                 example: Build muscle
 *               level:
 *                 type: string
 *                 enum: [BEGINNER, INTERMEDIATE, ADVANCED]
 *                 example: INTERMEDIATE
 *     responses:
 *       200:
 *         description: Member updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Member not found
 */
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER", "RECEPTIONIST"),
  updateMember
);

/**
 * @swagger
 * /api/members/{id}:
 *   delete:
 *     summary: Delete a member profile
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 6ab6878512d539c14ac93547
 *     responses:
 *       200:
 *         description: Member deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Member not found
 */
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  deleteMember
);

module.exports = router;