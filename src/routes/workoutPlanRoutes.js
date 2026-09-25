const express = require("express");

const {
  createWorkoutPlan,
} = require("../controllers/workoutPlanController");

const router = express.Router();

/**
 * @swagger
 * /api/workout-plans:
 *   post:
 *     summary: Create a workout plan
 *     tags: [Workout Plans]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - coachId
 *               - plan
 *             properties:
 *               coachId:
 *                 type: string
 *                 example: 65abc1234567890123456789
 *               memberId:
 *                 type: string
 *                 nullable: true
 *                 example: 65def1234567890123456789
 *               classId:
 *                 type: string
 *                 nullable: true
 *                 example: 65ghi1234567890123456789
 *               plan:
 *                 type: string
 *                 example: "Khởi động 10 phút. Squat 3x12. Push-up 3x10. Plank 3x30 giây."
 *     responses:
 *       201:
 *         description: Workout plan created successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Coach, Member or Class not found
 */
router.post("/", createWorkoutPlan);

module.exports = router;
