const express = require("express");

const {
  createSubject,
} = require("../controllers/subjectController");

const router = express.Router();

/**
 * @swagger
 * /api/subjects:
 *   post:
 *     summary: Create a subject
 *     tags: [Subjects]
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
 *       409:
 *         description: Subject already exists
 */
router.post("/", createSubject);

module.exports = router;