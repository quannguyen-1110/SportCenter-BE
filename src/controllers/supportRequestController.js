const mongoose = require("mongoose");
const SupportRequest = require("../models/SupportRequest");
const Member = require("../models/Member");

const VALID_STATUSES = ["PENDING", "RESOLVED"];

const isValidId = (id) => mongoose.isValidObjectId(id);

// POST /api/support-requests
// MEMBER sends their own request.
// RECEPTIONIST/CENTER_MANAGER can log a request for a member.
const createSupportRequest = async (req, res) => {
  try {
    const { message, memberId } = req.body;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "message is required",
      });
    }

    if (message.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        message: "message must not exceed 2000 characters",
      });
    }

    let targetMember;

    if (req.user.role === "MEMBER") {
      // Members can only create requests for themselves.
      targetMember = await Member.findOne({
        userId: req.user.userId,
      });

      if (!targetMember) {
        return res.status(404).json({
          success: false,
          message: "Member profile not found",
        });
      }
    } else {
      if (!memberId || !isValidId(memberId)) {
        return res.status(400).json({
          success: false,
          message: "A valid memberId is required",
        });
      }

      targetMember = await Member.findById(memberId);

      if (!targetMember) {
        return res.status(404).json({
          success: false,
          message: "Member not found",
        });
      }
    }

    const supportRequest = await SupportRequest.create({
      memberId: targetMember._id,
      message: message.trim(),
      status: "PENDING",
    });

    await supportRequest.populate(
      "memberId",
      "fullName phone"
    );

    return res.status(201).json({
      success: true,
      message: "Support request created successfully",
      data: supportRequest,
    });
  } catch (error) {
    console.error("Create support request error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET /api/support-requests
// Members see only their own requests.
// Staff can see all requests and filter by status.
const getSupportRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};

    if (req.user.role === "MEMBER") {
      const member = await Member.findOne({
        userId: req.user.userId,
      });

      if (!member) {
        return res.status(404).json({
          success: false,
          message: "Member profile not found",
        });
      }

      filter.memberId = member._id;
    } else if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "status must be PENDING or RESOLVED",
        });
      }

      filter.status = status;
    }

    // If a staff user supplies status, filter the results.
    if (
      req.user.role !== "MEMBER" &&
      status !== undefined &&
      !filter.status
    ) {
      filter.status = status;
    }

    const requests = await SupportRequest.find(filter)
      .populate("memberId", "fullName phone")
      .sort({ createdAt: -1 })
      .limit(100);

    return res.status(200).json({
      success: true,
      message: "Support requests retrieved successfully",
      data: requests,
    });
  } catch (error) {
    console.error("Get support requests error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// PUT /api/support-requests/:id/status
// Only Receptionist/Center Manager can resolve or reopen a request.
const updateSupportRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid support request ID",
      });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status must be PENDING or RESOLVED",
      });
    }

    const supportRequest = await SupportRequest.findById(id);

    if (!supportRequest) {
      return res.status(404).json({
        success: false,
        message: "Support request not found",
      });
    }

    supportRequest.status = status;
    await supportRequest.save();

    await supportRequest.populate(
      "memberId",
      "fullName phone"
    );

    return res.status(200).json({
      success: true,
      message: "Support request status updated successfully",
      data: supportRequest,
    });
  } catch (error) {
    console.error("Update support request status error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createSupportRequest,
  getSupportRequests,
  updateSupportRequestStatus,
};