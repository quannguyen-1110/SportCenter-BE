
const mongoose = require("mongoose");

const Room = require("../models/Room");
const Schedule = require("../models/Schedule");

// CREATE room
const createRoom = async (req, res) => {
  try {
    const { roomNumber, name, capacity, status } = req.body;

    if (
      typeof roomNumber !== "string" ||
      !roomNumber.trim() ||
      capacity === undefined ||
      capacity === null ||
      capacity === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "roomNumber and capacity are required",
      });
    }

    const parsedCapacity = Number(capacity);

    if (
      !Number.isInteger(parsedCapacity) ||
      parsedCapacity < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "capacity must be a positive integer",
      });
    }

    if (
      status !== undefined &&
      !["ACTIVE", "INACTIVE"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "status must be ACTIVE or INACTIVE",
      });
    }

    const normalizedRoomNumber = roomNumber.trim();

    const existingRoom = await Room.findOne({
      roomNumber: normalizedRoomNumber,
    });

    if (existingRoom) {
      return res.status(409).json({
        success: false,
        message: "Room number already exists",
      });
    }

    const room = await Room.create({
      roomNumber: normalizedRoomNumber,
      name: typeof name === "string" ? name.trim() : "",
      capacity: parsedCapacity,
      status: status || "ACTIVE",
    });

    return res.status(201).json({
      success: true,
      message: "Room created successfully",
      data: room,
    });
  } catch (error) {
    console.error("Create room error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Room number already exists",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET all rooms
const getRooms = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};

    if (status !== undefined) {
      if (!["ACTIVE", "INACTIVE"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "status must be ACTIVE or INACTIVE",
        });
      }

      filter.status = status;
    }

    const rooms = await Room.find(filter).sort({
      roomNumber: 1,
    });

    return res.status(200).json({
      success: true,
      message: "Rooms retrieved successfully",
      data: rooms,
    });
  } catch (error) {
    console.error("Get rooms error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET room by ID
const getRoomById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid room ID",
      });
    }

    const room = await Room.findById(id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Room retrieved successfully",
      data: room,
    });
  } catch (error) {
    console.error("Get room by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// UPDATE room
const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const { roomNumber, name, capacity, status } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid room ID",
      });
    }

    const room = await Room.findById(id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const updates = {};

    if (roomNumber !== undefined) {
      if (
        typeof roomNumber !== "string" ||
        !roomNumber.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "roomNumber must be a non-empty string",
        });
      }

      updates.roomNumber = roomNumber.trim();
    }

    if (name !== undefined) {
      if (typeof name !== "string") {
        return res.status(400).json({
          success: false,
          message: "name must be a string",
        });
      }

      updates.name = name.trim();
    }

    if (capacity !== undefined) {
      const parsedCapacity = Number(capacity);

      if (
        capacity === "" ||
        !Number.isInteger(parsedCapacity) ||
        parsedCapacity < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "capacity must be a positive integer",
        });
      }

      updates.capacity = parsedCapacity;
    }

    if (status !== undefined) {
      if (!["ACTIVE", "INACTIVE"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "status must be ACTIVE or INACTIVE",
        });
      }

      // Do not deactivate a room that has future scheduled classes.
      if (status === "INACTIVE") {
        const now = new Date();

        const hasUpcomingSchedule = await Schedule.exists({
          roomId: room._id,
          status: "SCHEDULED",
          date: { $gte: new Date(now.setUTCHours(0, 0, 0, 0)) },
        });

        if (hasUpcomingSchedule) {
          return res.status(409).json({
            success: false,
            message:
              "Cannot deactivate a room with upcoming scheduled classes",
          });
        }
      }

      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one field must be provided for update",
      });
    }

    Object.assign(room, updates);
    await room.save();

    return res.status(200).json({
      success: true,
      message: "Room updated successfully",
      data: room,
    });
  } catch (error) {
    console.error("Update room error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Room number already exists",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE room
const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid room ID",
      });
    }

    const room = await Room.findById(id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const hasSchedules = await Schedule.exists({
      roomId: room._id,
    });

    if (hasSchedules) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete a room linked to schedules. Set its status to INACTIVE instead when allowed.",
      });
    }

    await Room.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Room deleted successfully",
    });
  } catch (error) {
    console.error("Delete room error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createRoom,
  getRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
};
