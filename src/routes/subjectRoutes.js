const express = require("express");

const {
  createSubject,
  getSubjects,
} = require("../controllers/subjectController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/subjects:
 *   post:
 *     summary: Create a subject
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Football
 *     responses:
 *       201:
 *         description: Subject created successfully
 *       400:
 *         description: Subject name is required
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       409:
 *         description: Subject already exists
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  createSubject
);

/**
 * @swagger
 * /api/subjects:
 *   get:
 *     summary: Get all subjects
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subjects retrieved successfully
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.get(
  "/",
  authMiddleware,
  getSubjects
);

module.exports = router;