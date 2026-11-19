const express = require("express");

const { suggestWorkout, chat } = require("../controllers/aiController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/ai/workout-suggestions:
 *   post:
 *     summary: AI suggests a workout plan for one student or a whole class (coach only)
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               memberId: { type: string, description: One student in your classes }
 *               classId: { type: string, description: A class you teach }
 *               notes: { type: string, example: "Đau gối nhẹ, tránh nhảy" }
 *               save: { type: boolean, description: Also save as a DRAFT workout plan with source AI }
 *     responses:
 *       200:
 *         description: Structured suggestion, plain-text plan and the saved plan if requested
 *       503:
 *         description: AI is not configured on the server
 */
router.post("/workout-suggestions", authMiddleware, roleMiddleware("COACH"), suggestWorkout);

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: Member asks the AI assistant about schedules, exercises or center services
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [messages]
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role: { type: string, enum: [user, assistant] }
 *                     content: { type: string }
 *                 example: [{ role: user, content: "Tuần này tôi có lịch tập nào?" }]
 *     responses:
 *       200:
 *         description: Assistant reply
 */
router.post("/chat", authMiddleware, roleMiddleware("MEMBER"), chat);

module.exports = router;
