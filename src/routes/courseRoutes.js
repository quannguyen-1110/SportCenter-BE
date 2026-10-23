
const express = require("express");

const {
  createCourse,
  getCourses,
  updateCourse,
  deleteCourse,
} = require("../controllers/courseController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Courses
 *   description: Course management APIs
 */

/**
 * @swagger
 * /api/courses:
 *   post:
 *     summary: Create a new course
 *     description: Create a course belonging to an existing sports subject.
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subjectId
 *               - name
 *               - price
 *             properties:
 *               subjectId:
 *                 type: string
 *                 description: ID of the sports subject this course belongs to.
 *                 example: "65abc12345678901234567890"
 *               name:
 *                 type: string
 *                 example: Yoga Basic
 *               description:
 *                 type: string
 *                 example: Basic yoga training course
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 example: 1500000
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE]
 *                 default: ACTIVE
 *                 example: ACTIVE
 *     responses:
 *       201:
 *         description: Course created successfully
 *       400:
 *         description: Invalid subjectId, name, price, or status
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Subject not found
 *       409:
 *         description: Conflict with an existing unique field
 *       500:
 *         description: Internal server error
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  createCourse
);

/**
 * @swagger
 * /api/courses:
 *   get:
 *     summary: Get all courses including prices and subjects
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Courses retrieved successfully
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.get(
  "/",
  authMiddleware,
  getCourses
);

/**
 * @swagger
 * /api/courses/{id}:
 *   put:
 *     summary: Update course information
 *     description: Update the course name, subject, description, price, or status.
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Course ID
 *         schema:
 *           type: string
 *         example: "65abc12345678901234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subjectId:
 *                 type: string
 *                 description: ID of the new sports subject.
 *                 example: "65def12345678901234567890"
 *               name:
 *                 type: string
 *                 example: Yoga Advanced
 *               description:
 *                 type: string
 *                 example: Advanced yoga training course
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 example: 2000000
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE]
 *                 example: ACTIVE
 *     responses:
 *       200:
 *         description: Course updated successfully
 *       400:
 *         description: Invalid course ID or request data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Course or subject not found
 *       409:
 *         description: Course name already exists
 *       500:
 *         description: Internal server error
 */
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  updateCourse
);

/**
 * @swagger
 * /api/courses/{id}:
 *   delete:
 *     summary: Delete a course
 *     description: A course cannot be deleted while used by a class or learning path.
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Course ID
 *         schema:
 *           type: string
 *         example: "65abc12345678901234567890"
 *     responses:
 *       200:
 *         description: Course deleted successfully
 *       400:
 *         description: Invalid course ID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Course not found
 *       409:
 *         description: Course is being used by a class or learning path
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  deleteCourse
);

module.exports = router;
