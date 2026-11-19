
const express = require("express");

const {
  createCoach,
  getCoaches,
  updateCoach,
  deleteCoach,
  getMyCoachProfile,
  getMyStudents,
  updateMyCoachProfile,
} = require("../controllers/coachController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();
const { createCoachAccount } = require("../controllers/coachAccountController");

/**
 * @swagger
 * /api/coaches/accounts:
 *   post:
 *     summary: Manager provisions a coach login account, profile and specialty
 *     description: Creates User and Coach atomically. Role is always COACH. Does not send an invitation email or return credentials.
 *     tags: [Coaches]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, fullName, phone, subjectIds]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *                 writeOnly: true
 *                 minLength: 6
 *                 description: Initial password, at most 72 UTF-8 bytes.
 *               fullName:
 *                 type: string
 *               phone:
 *                 type: string
 *               subjectIds:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 1
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Account and coach profile created; data contains user and coach.
 *       400:
 *         description: Invalid account or specialty data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: CENTER_MANAGER role required
 *       404:
 *         description: Subject not found
 *       409:
 *         description: Email already exists
 *       500:
 *         description: Account creation failed
 */
router.post("/accounts", authMiddleware, roleMiddleware("CENTER_MANAGER"), createCoachAccount);


/**
 * @swagger
 * /api/coaches:
 *   get:
 *     summary: Get all coaches or filter coaches by subject
 *     description: |
 *       Get all coaches when subjectId is omitted.
 *       Filter coaches by one sport subject when subjectId is provided.
 *     tags: [Coaches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: subjectId
 *         required: false
 *         schema:
 *           type: string
 *         description: ID of the sport subject
 *         example: 6ab6878512d539c14ac93547
 *     responses:
 *       200:
 *         description: Coaches retrieved successfully
 *       400:
 *         description: Invalid subjectId
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Subject not found
 *       500:
 *         description: Internal server error
 */
router.get("/", authMiddleware, getCoaches);

/**
 * @swagger
 * /api/coaches:
 *   post:
 *     summary: Create a coach profile with exactly one subject specialty
 *     tags: [Coaches]
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
 *               - subjectIds
 *             properties:
 *               userId:
 *                 type: string
 *                 example: 6ab6878512d539c14ac93547
 *               subjectIds:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 1
 *                 items:
 *                   type: string
 *                 description: Exactly one ID referencing an existing subject.
 *               fullName:
 *                 type: string
 *                 example: Nguyen Van A
 *               phone:
 *                 type: string
 *                 example: "0901234567"
 *     responses:
 *       201:
 *         description: Coach created successfully
 *       400:
 *         description: Invalid input or User role must be COACH
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: User or subject not found
 *       409:
 *         description: Coach profile already exists
 *       500:
 *         description: Internal server error
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  createCoach
);

/**
 * @swagger
 * /api/coaches/me:
 *   get:
 *     summary: Get my coach profile
 *     description: Retrieve the profile belonging to the authenticated coach.
 *     tags: [Coaches]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Coach profile retrieved successfully
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Access denied - COACH role required
 *       404:
 *         description: Coach profile not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/me",
  authMiddleware,
  roleMiddleware("COACH"),
  getMyCoachProfile
);
/**
 * @swagger
 * /api/coaches/me:
 *   patch:
 *     summary: Update my coach profile
 *     description: COACH can update their own fullName and phone only.
 *     tags: [Coaches]
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
 *                 example: Nguyen Van A
 *               phone:
 *                 type: string
 *                 example: "0901234567"
 *     responses:
 *       200:
 *         description: Coach profile updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied - COACH role required
 *       404:
 *         description: Coach profile not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/me",
  authMiddleware,
  roleMiddleware("COACH"),
  updateMyCoachProfile
);
/**
 * @swagger
 * /api/coaches/my-students:
 *   get:
 *     summary: Get students in my assigned classes
 *     description: |
 *       Access: COACH
 *
 *       Returns students with CONFIRMED registrations
 *       in classes assigned to the authenticated coach.
 *
 *       Requires a valid JWT Bearer Token.
 *     tags: [Coaches]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: My students retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied - COACH role required
 *       404:
 *         description: Coach profile not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/my-students",
  authMiddleware,
  roleMiddleware("COACH"),
  getMyStudents
);

/**
 * @swagger
 * /api/coaches/{id}:
 *   put:
 *     summary: Update a coach profile or its single subject specialty
 *     description: Provide at least one of fullName, phone or subjectIds. Legacy profiles without a specialty must provide subjectIds. The specialty must match any assigned class.
 *     tags: [Coaches]
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
 *             minProperties: 1
 *             properties:
 *               subjectIds:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 1
 *                 items:
 *                   type: string
 *                 description: Array with exactly one existing subject ID. A coach cannot change to a different subject while assigned to a class.
 *               fullName:
 *                 type: string
 *                 example: Nguyen Van B
 *               phone:
 *                 type: string
 *                 example: "0912345678"
 *     responses:
 *       200:
 *         description: Coach updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Coach or Subject not found
 *       409:
 *         description: Specialty conflicts with an assigned class
 *       500:
 *         description: Internal server error
 */
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  updateCoach
);

/**
 * @swagger
 * /api/coaches/{id}:
 *   delete:
 *     summary: Delete a coach profile
 *     tags: [Coaches]
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
 *         description: Coach deleted successfully
 *       400:
 *         description: Invalid coach ID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Coach not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  deleteCoach
);

module.exports = router;
