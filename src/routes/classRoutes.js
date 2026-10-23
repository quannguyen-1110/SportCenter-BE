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
 * tags:
 *   name: Classes
 *   description: Class management APIs
 */

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
router.get("/", authMiddleware, getClasses);

/**
 * @swagger
 * /api/classes:
 *   post:
 *     summary: Create a class
 *     description: Create a class for a course. subjectId is derived from the selected course.
 *     tags: [Classes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, courseId, coachId]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Football Beginner
 *               courseId:
 *                 type: string
 *                 example: 65ghi12345678901234567890
 *               coachId:
 *                 type: string
 *                 example: 65def12345678901234567890
 *               subjectId:
 *                 type: string
 *                 description: Optional; if supplied, must match the course subject.
 *                 example: 65abc12345678901234567890
 *               classType:
 *                 type: string
 *                 enum: [GROUP, PERSONAL]
 *                 default: GROUP
 *                 description: GROUP accepts multiple members; PERSONAL accepts one active registration.
 *                 example: GROUP
 *     responses:
 *       201:
 *         description: Class created successfully
 *       400:
 *         description: Invalid input or subject does not match the course
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Course or coach not found
 *       409:
 *         description: Coach already assigned or course subject is invalid
 *       500:
 *         description: Internal server error
 */
router.post("/", authMiddleware, roleMiddleware("CENTER_MANAGER"), createClass);

/**
 * @swagger
 * /api/classes/{id}:
 *   put:
 *     summary: Update a class
 *     description: Update class name, course, coach and optionally classType. Existing records cannot be moved to another course once dependent data exists.
 *     tags: [Classes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 65abc12345678901234567890
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, courseId, coachId]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Football Intermediate
 *               courseId:
 *                 type: string
 *                 example: 65ghi12345678901234567890
 *               coachId:
 *                 type: string
 *                 example: 65def12345678901234567890
 *               subjectId:
 *                 type: string
 *                 description: Optional; if supplied, must match the course subject.
 *                 example: 65abc12345678901234567890
 *               classType:
 *                 type: string
 *                 enum: [GROUP, PERSONAL]
 *                 description: Cannot be changed to PERSONAL while more than one registration is pending or confirmed.
 *                 example: PERSONAL
 *     responses:
 *       200:
 *         description: Class updated successfully
 *       400:
 *         description: Invalid input or subject does not match the course
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Class, course or coach not found
 *       409:
 *         description: Coach already assigned, course subject invalid, or class has incompatible registrations/dependencies
 *       500:
 *         description: Internal server error
 */
router.put("/:id", authMiddleware, roleMiddleware("CENTER_MANAGER"), updateClass);

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
 *         example: 65abc12345678901234567890
 *     responses:
 *       200:
 *         description: Class deleted successfully
 *       400:
 *         description: Invalid class ID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Class not found
 *       409:
 *         description: Class still has related lessons, schedules, registrations, attendance or homework
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", authMiddleware, roleMiddleware("CENTER_MANAGER"), deleteClass);

module.exports = router;
