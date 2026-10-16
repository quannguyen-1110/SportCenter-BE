const express = require("express");

const {
  createWorkoutPlan,
  getWorkoutPlans,
  updateWorkoutPlan,
  deleteWorkoutPlan,
} = require("../controllers/workoutPlanController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/workout-plans:
 *   get:
 *     summary: Get workout plans accessible to the current user
 *     tags: [Workout Plans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workout plans retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: User profile not found
 */
router.get("/", authMiddleware, getWorkoutPlans);

/**
 * @swagger
 * /api/workout-plans:
 *   post:
 *     summary: Create an individual or class workout plan
 *     description: >
 *       For an individual plan, provide memberId.
 *       For a class-wide plan, provide classId and omit memberId.
 *       The authenticated Coach must be assigned to the specified class.
 *     tags: [Workout Plans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - goal
 *               - level
 *               - plan
 *             properties:
 *               coachId:
 *                 type: string
 *                 description: Optional; must match the authenticated Coach if provided.
 *                 example: 65abc1234567890123456789
 *               memberId:
 *                 type: string
 *                 nullable: true
 *                 description: Member ID for an individual plan.
 *                 example: 65def1234567890123456789
 *               classId:
 *                 type: string
 *                 nullable: true
 *                 description: Class ID for a class-wide plan.
 *                 example: 65fed1234567890123456789
 *               goal:
 *                 type: string
 *                 example: Weight loss
 *               level:
 *                 type: string
 *                 enum: [BEGINNER, INTERMEDIATE, ADVANCED]
 *                 example: BEGINNER
 *               plan:
 *                 type: string
 *                 example: "Khởi động 10 phút. Squat 3x12. Push-up 3x10. Plank 3x30 giây."
 *               source:
 *                 type: string
 *                 enum: [COACH, AI]
 *                 default: COACH
 *                 example: COACH
 *               status:
 *                 type: string
 *                 enum: [DRAFT, APPROVED]
 *                 default: DRAFT
 *                 example: DRAFT
 *     responses:
 *       201:
 *         description: Workout plan created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied or Coach is not assigned to the class
 *       404:
 *         description: Coach, Member or Class not found
 *       500:
 *         description: Internal server error
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("COACH"),
  createWorkoutPlan
);

/**
 * @swagger
 * /api/workout-plans/{id}:
 *   put:
 *     summary: Update an individual or class workout plan
 *     description: >
 *       For an individual plan, provide memberId.
 *       For a class-wide plan, provide classId and omit memberId.
 *       Only the Coach who owns the plan can update it.
 *     tags: [Workout Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Workout plan ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - goal
 *               - level
 *               - plan
 *             properties:
 *               coachId:
 *                 type: string
 *                 description: Optional; must match the authenticated Coach if provided.
 *                 example: 65abc1234567890123456789
 *               memberId:
 *                 type: string
 *                 nullable: true
 *                 description: Member ID for an individual plan.
 *                 example: 65def1234567890123456789
 *               classId:
 *                 type: string
 *                 nullable: true
 *                 description: Class ID for a class-wide plan.
 *                 example: 65fed1234567890123456789
 *               goal:
 *                 type: string
 *                 example: Build muscle
 *               level:
 *                 type: string
 *                 enum: [BEGINNER, INTERMEDIATE, ADVANCED]
 *                 example: INTERMEDIATE
 *               plan:
 *                 type: string
 *                 example: "Khởi động 10 phút. Squat 4x12. Push-up 4x10."
 *               source:
 *                 type: string
 *                 enum: [COACH, AI]
 *                 example: COACH
 *               status:
 *                 type: string
 *                 enum: [DRAFT, APPROVED]
 *                 example: APPROVED
 *     responses:
 *       200:
 *         description: Workout plan updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Workout plan, Member or Class not found
 *       500:
 *         description: Internal server error
 */
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("COACH"),
  updateWorkoutPlan
);

/**
 * @swagger
 * /api/workout-plans/{id}:
 *   delete:
 *     summary: Delete a workout plan
 *     tags: [Workout Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Workout plan ID
 *     responses:
 *       200:
 *         description: Workout plan deleted successfully
 *       400:
 *         description: Invalid workout plan ID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Workout plan not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("COACH"),
  deleteWorkoutPlan
);

module.exports = router;