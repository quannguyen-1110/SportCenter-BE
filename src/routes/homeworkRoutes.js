const express = require("express");
const router = express.Router();

const { createHomework, getMyHomeworks,} = require("../controllers/homeworkController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * tags:
 *   name: Homeworks
 *   description: Coach homework assignment APIs
 */

/**
 * @swagger
 * /api/homeworks:
 *   post:
 *     summary: Assign homework to a class or an individual member
 *     description: >
 *       Only COACH can use this endpoint. A coach can assign homework
 *       to their own class or to a confirmed member in their class.
 *       Notifications are automatically created for the recipients.
 *     tags: [Homeworks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *             properties:
 *               classId:
 *                 type: string
 *                 description: Assign to the coach's class. Do not provide memberId together with this field.
 *                 example: "671a12345678901234567890"
 *               memberId:
 *                 type: string
 *                 description: Assign to one confirmed member of the coach's class. Do not provide classId together with this field.
 *                 example: "671b12345678901234567890"
 *               title:
 *                 type: string
 *                 maxLength: 200
 *                 example: "Bài tập buổi 3"
 *               description:
 *                 type: string
 *                 example: "Hoàn thành 3 hiệp chống đẩy, mỗi hiệp 12 lần."
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 example: "2026-11-01T17:00:00.000Z"
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: []
 *     responses:
 *       201:
 *         description: Homework created and notifications generated
 *       400:
 *         description: Invalid input or missing required information
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Coach is not allowed to assign homework to this class or member
 *       404:
 *         description: Coach, class, or member not found
 *       500:
 *         description: Server error
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("COACH"),
  createHomework
);

/**
 * @swagger
 * /api/homeworks/my:
 *   get:
 *     summary: Get homework assigned to the current user
 *     description: >
 *       COACH retrieves homework they created.
 *       MEMBER retrieves personal homework and homework assigned
 *       to their confirmed classes.
 *     tags: [Homeworks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Homework list retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Role not allowed
 *       404:
 *         description: Coach or member profile not found
 */
router.get(
  "/my",
  authMiddleware,
  roleMiddleware("COACH", "MEMBER"),
  getMyHomeworks
);

module.exports = router;