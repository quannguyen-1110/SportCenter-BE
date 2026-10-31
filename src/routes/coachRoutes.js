
const express = require("express");

const {
  createCoach,
  getCoaches,
  updateCoach,
  deleteCoach,
  getMyCoachProfile,
  getMyStudents,
} = require("../controllers/coachController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

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
 *     summary: Create a coach profile
 *     description: Each coach is assigned to exactly one sport subject.
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
 *               - subjectId
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
 *               subjectId:
 *                 type: string
 *                 description: Sport subject ID assigned to this coach
 *                 example: 6ab6878512d539c14ac93548
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
 *         description: User or Subject not found
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
 *     summary: Update a coach profile
 *     description: Update coach information and/or assigned sport subject.
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
 *             description: Provide at least one field to update.
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: Nguyen Van B
 *               phone:
 *                 type: string
 *                 example: "0912345678"
 *               subjectId:
 *                 type: string
 *                 description: New sport subject ID
 *                 example: 6ab6878512d539c14ac93548
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
