
const express = require("express");

const {
  createRoom,
  getRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
} = require("../controllers/roomController");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/rooms:
 *   post:
 *     summary: Create a room
 *     description: Access CENTER_MANAGER only.
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomNumber
 *               - capacity
 *             properties:
 *               roomNumber:
 *                 type: string
 *                 example: "001"
 *               name:
 *                 type: string
 *                 example: "Phòng Yoga 001"
 *               capacity:
 *                 type: integer
 *                 minimum: 1
 *                 example: 25
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE]
 *                 example: ACTIVE
 *     responses:
 *       201:
 *         description: Room created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       409:
 *         description: Room number already exists
 *       500:
 *         description: Internal server error
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  createRoom
);

/**
 * @swagger
 * /api/rooms:
 *   get:
 *     summary: Get all rooms
 *     description: Access all authenticated roles. Optionally filter by status.
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE]
 *         example: ACTIVE
 *     responses:
 *       200:
 *         description: Rooms retrieved successfully
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.get("/", authMiddleware, getRooms);

/**
 * @swagger
 * /api/rooms/{id}:
 *   get:
 *     summary: Get room by ID
 *     description: Access all authenticated roles.
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 67abc1234567890123456789
 *     responses:
 *       200:
 *         description: Room retrieved successfully
 *       400:
 *         description: Invalid room ID
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Room not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", authMiddleware, getRoomById);

/**
 * @swagger
 * /api/rooms/{id}:
 *   put:
 *     summary: Update a room
 *     description: Access CENTER_MANAGER only. Send only the fields to update.
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 67abc1234567890123456789
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roomNumber:
 *                 type: string
 *                 example: "001"
 *               name:
 *                 type: string
 *                 example: "Phòng Yoga 001"
 *               capacity:
 *                 type: integer
 *                 minimum: 1
 *                 example: 30
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE]
 *                 example: ACTIVE
 *     responses:
 *       200:
 *         description: Room updated successfully
 *       400:
 *         description: Invalid input or no fields provided
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Room not found
 *       409:
 *         description: Duplicate room number or room has upcoming schedules
 *       500:
 *         description: Internal server error
 */
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  updateRoom
);

/**
 * @swagger
 * /api/rooms/{id}:
 *   delete:
 *     summary: Delete a room
 *     description: Access CENTER_MANAGER only. A room linked to schedules cannot be deleted.
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 67abc1234567890123456789
 *     responses:
 *       200:
 *         description: Room deleted successfully
 *       400:
 *         description: Invalid room ID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Room not found
 *       409:
 *         description: Room is linked to schedules
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("CENTER_MANAGER"),
  deleteRoom
);

module.exports = router;
