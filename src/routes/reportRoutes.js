const express = require("express");

const { getOverview, getReportSummary } = require("../controllers/reportController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/reports/overview:
 *   get:
 *     summary: Members, class registrations, revenue and attendance over time
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date, example: "2026-10-01" }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date, example: "2026-10-31" }
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [day, week, month], default: day }
 *     responses:
 *       200:
 *         description: Report data
 *       400:
 *         description: Invalid range
 */
router.get("/overview", authMiddleware, roleMiddleware("CENTER_MANAGER"), getOverview);

router.get("/summary", authMiddleware, roleMiddleware("CENTER_MANAGER"), getReportSummary);
module.exports = router;
