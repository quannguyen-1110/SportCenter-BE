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
 *     summary: Get all workout plans
 *     tags: [Workout Plans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workout plans retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get(
  "/",
  authMiddleware,
  getWorkoutPlans
);

/**
 * @swagger
 * /api/workout-plans:
 *   post:
 *     summary: Create a workout plan
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
 *               - coachId
 *               - memberId
 *               - goal
 *               - level
 *               - plan
 *             properties:
 *               coachId:
 *                 type: string
 *                 example: 65abc1234567890123456789
 *               memberId:
 *                 type: string
 *                 example: 65def1234567890123456789
 *               classId:
 *                 type: string
 *                 nullable: true
 *                 example: 65ghi1234567890123456789
 *               goal:
 *                 type: string
 *                 example: Weight loss
 *               level:
 *                 type: string
 *                 enum:
 *                   - BEGINNER
 *                   - INTERMEDIATE
 *                   - ADVANCED
 *                 example: BEGINNER
 *               plan:
 *                 type: string
 *                 example: "Khởi động 10 phút. Squat 3x12. Push-up 3x10. Plank 3x30 giây."
 *               source:
 *                 type: string
 *                 enum:
 *                   - COACH
 *                   - AI
 *                 default: COACH
 *                 example: COACH
 *               status:
 *                 type: string
 *                 enum:
 *                   - DRAFT
 *                   - APPROVED
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
 *         description: Access denied
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
 *     summary: Update a workout plan
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
 *               - coachId
 *               - memberId
 *               - goal
 *               - level
 *               - plan
 *             properties:
 *               coachId:
 *                 type: string
 *                 example: 65abc1234567890123456789
 *               memberId:
 *                 type: string
 *                 example: 65def1234567890123456789
 *               classId:
 *                 type: string
 *                 nullable: true
 *                 example: 65ghi1234567890123456789
 *               goal:
 *                 type: string
 *                 example: Weight loss
 *               level:
 *                 type: string
 *                 enum:
 *                   - BEGINNER
 *                   - INTERMEDIATE
 *                   - ADVANCED
 *                 example: INTERMEDIATE
 *               plan:
 *                 type: string
 *                 example: "Khởi động 10 phút. Squat 4x12. Push-up 4x10."
 *               source:
 *                 type: string
 *                 enum:
 *                   - COACH
 *                   - AI
 *                 example: COACH
 *               status:
 *                 type: string
 *                 enum:
 *                   - DRAFT
 *                   - APPROVED
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
 *         description: Workout plan, Coach, Member or Class not found
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