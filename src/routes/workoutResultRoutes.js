const express = require("express");

const {
  createWorkoutResult,
  getWorkoutResults,
} = require("../controllers/workoutResultController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/workout-results:
 *   get:
 *     summary: Get all workout results
 *     tags: [Workout Results]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workout results retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get(
  "/",
  authMiddleware,
  getWorkoutResults
);

/**
 * @swagger
 * /api/workout-results:
 *   post:
 *     summary: Create a workout result
 *     tags: [Workout Results]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workoutPlanId
 *               - memberId
 *               - result
 *             properties:
 *               workoutPlanId:
 *                 type: string
 *                 example: 65abc1234567890123456789
 *               memberId:
 *                 type: string
 *                 example: 65def1234567890123456789
 *               result:
 *                 type: string
 *                 example: "Hoàn thành 3x12 squat và 3x10 push-up"
 *               comment:
 *                 type: string
 *                 example: "Thực hiện tốt, cần cải thiện kỹ thuật squat."
 *     responses:
 *       201:
 *         description: Workout result created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Workout plan or Member not found
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("COACH", "MEMBER"),
  createWorkoutResult
);

module.exports = router;