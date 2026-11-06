
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
 *     description: Create a course with personal and group prices for the entire course.
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
 *               - pricing
 *             properties:
 *               subjectId:
 *                 type: string
 *                 example: "65abc12345678901234567890"
 *               name:
 *                 type: string
 *                 example: Badminton Basic
 *               description:
 *                 type: string
 *                 example: Basic badminton training course
 *               pricing:
 *                 type: object
 *                 required:
 *                   - personal
 *                   - group
 *                 properties:
 *                   personal:
 *                     type: number
 *                     minimum: 0
 *                     example: 2000000
 *                     description: One-time price for the entire personal course.
 *                   group:
 *                     type: number
 *                     minimum: 0
 *                     example: 1200000
 *                     description: One-time price for the entire group course.
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE]
 *                 default: ACTIVE
 *                 example: ACTIVE
 *     responses:
 *       201:
 *         description: Course created successfully
 *       400:
 *         description: Invalid subjectId, name, pricing, or status
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Subject not found
 *       409:
 *         description: Course name already exists
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
 *     summary: Get all courses including both prices and subjects
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Courses retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       subjectId:
 *                         type: object
 *                       name:
 *                         type: string
 *                         example: Badminton Basic
 *                       description:
 *                         type: string
 *                       pricing:
 *                         type: object
 *                         properties:
 *                           personal:
 *                             type: number
 *                             example: 2000000
 *                           group:
 *                             type: number
 *                             example: 1200000
 *                       status:
 *                         type: string
 *                         enum: [ACTIVE, INACTIVE]
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
 *     description: Update course name, subject, description, personal price, group price, or status.
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
 *                 example: "65def12345678901234567890"
 *               name:
 *                 type: string
 *                 example: Badminton Advanced
 *               description:
 *                 type: string
 *                 example: Advanced badminton training course
 *               pricing:
 *                 type: object
 *                 required:
 *                   - personal
 *                   - group
 *                 properties:
 *                   personal:
 *                     type: number
 *                     minimum: 0
 *                     example: 2500000
 *                   group:
 *                     type: number
 *                     minimum: 0
 *                     example: 1500000
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
