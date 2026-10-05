const express = require("express");

const {
  createWorkoutPlan,
  getWorkoutPlans,
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

module.exports = router;