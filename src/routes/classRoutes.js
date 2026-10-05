const express = require("express");

const {
  createClass,
  getClasses,
  updateClass,
  deleteClass,
} = require("../controllers/classController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/classes:
 *   get:
 *     summary: Get all classes
 *     tags: [Classes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Classes retrieved successfully
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.get(
  "/",
  authMiddleware,
  getClasses
);

/**
 * @swagger
 * /api/classes:
 *   post:
 *     summary: Create a class
 *     tags: [Classes]
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
 *               - subjectId
 *               - courseId
 *               - coachId
 *             properties:
 *               name:
 *                 type: string
 *                 example: Football Beginner
 *               subjectId:
 *                 type: string
 *                 example: 65abc1234567890123456789
 *               courseId:
 *                 type: string
 *                 example: 65ghi1234567890123456789
 *               coachId:
 *                 type: string
 *                 example: 65def1234567890123456789
 *     responses:
 *       201:
 *         description: Class created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Subject, Course or Coach not found
 *       409:
 *         description: Coach is already assigned to another class
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  createClass
);

/**
 * @swagger
 * /api/classes/{id}:
 *   put:
 *     summary: Update a class
 *     tags: [Classes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 65abc1234567890123456789
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - subjectId
 *               - courseId
 *               - coachId
 *             properties:
 *               name:
 *                 type: string
 *                 example: Football Intermediate
 *               subjectId:
 *                 type: string
 *                 example: 65abc1234567890123456789
 *               courseId:
 *                 type: string
 *                 example: 65ghi1234567890123456789
 *               coachId:
 *                 type: string
 *                 example: 65def1234567890123456789
 *     responses:
 *       200:
 *         description: Class updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Class, Subject, Course or Coach not found
 *       409:
 *         description: Coach is already assigned to another class
 *       500:
 *         description: Internal server error
 */
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  updateClass
);

/**
 * @swagger
 * /api/classes/{id}:
 *   delete:
 *     summary: Delete a class
 *     tags: [Classes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 65abc1234567890123456789
 *     responses:
 *       200:
 *         description: Class deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Class not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  deleteClass
);

module.exports = router;