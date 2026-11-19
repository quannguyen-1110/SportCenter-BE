const mongoose = require("mongoose");
const SupportRequest = require("../models/SupportRequest");
const Member = require("../models/Member");
const Notification = require("../models/Notification");

const VALID_STATUSES = ["PENDING", "RESOLVED"];
const MAX_TEXT = 2000;

const isValidId = (id) => mongoose.isValidObjectId(id);

// Member name/phone, plus who logged and who answered the request.
const populateRequest = (query) =>
  query
    .populate("memberId", "fullName phone")
    .populate("createdBy", "email role")
    .populate("respondedBy", "email role");

const excerpt = (text, max = 80) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

// Tells the member that the center answered or closed their request.
// A failed notification must not undo the reply itself.
async function notifyMember(supportRequest, { response, resolved }) {
  try {
    const member = await Member.findById(supportRequest.memberId).select("userId");
    if (!member?.userId) return;

    const title = response
      ? resolved
        ? "Yêu cầu hỗ trợ đã được giải quyết"
        : "Trung tâm đã phản hồi yêu cầu hỗ trợ"
      : "Yêu cầu hỗ trợ đã được giải quyết";
    const message = response
      ? `Về yêu cầu "${excerpt(supportRequest.message)}": ${response}`
      : `Yêu cầu "${excerpt(supportRequest.message)}" đã được trung tâm xử lý.`;

    await Notification.create({ userId: member.userId, title, message });
  } catch (error) {
    console.error("Support request notification error:", error.message);
  }
}

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
      createdBy: req.user.userId,
    });

    await supportRequest.populate([
      { path: "memberId", select: "fullName phone" },
      { path: "createdBy", select: "email role" },
    ]);

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

    const requests = await populateRequest(SupportRequest.find(filter))
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

// PUT /api/support-requests/:id/status   body: { status?, response? }
// Only Receptionist/Center Manager can answer, resolve or reopen a request.
// - response: the answer sent to the member (stored with who/when, member is notified)
// - status: RESOLVED closes the request, PENDING reopens it; leave it out to answer without closing
const updateSupportRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const response = typeof req.body.response === "string" ? req.body.response.trim() : "";

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid support request ID",
      });
    }

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status must be PENDING or RESOLVED",
      });
    }
    if (note !== undefined && (typeof note !== "string" || !note.trim() || note.trim().length > 2000)) {
      return res.status(400).json({ success: false, message: "Handling note must contain 1 to 2000 characters" });
    }

    if (status === undefined && !response) {
      return res.status(400).json({
        success: false,
        message: "Send a response, a status, or both",
      });
    }

    if (response.length > MAX_TEXT) {
      return res.status(400).json({
        success: false,
        message: `response must not exceed ${MAX_TEXT} characters`,
      });
    }

    const supportRequest = await SupportRequest.findById(id);

    if (!supportRequest) {
      return res.status(404).json({
        success: false,
        message: "Support request not found",
      });
    }

    const wasResolved = supportRequest.status === "RESOLVED";

    if (response) {
      supportRequest.response = response;
      supportRequest.respondedBy = req.user.userId;
      supportRequest.respondedAt = new Date();
    }

    if (status !== undefined) {
      supportRequest.status = status;
      supportRequest.resolvedAt = status === "RESOLVED" ? supportRequest.resolvedAt || new Date() : null;
    }

    supportRequest.handledBy = req.user.userId;
    if (note !== undefined) supportRequest.handlingNotes.push({ text: note.trim(), staffId: req.user.userId });
    await supportRequest.save();

    // Notify on an answer, or when a request is closed now (not on reopen).
    const resolvedNow = supportRequest.status === "RESOLVED" && !wasResolved;
    if (response || resolvedNow) {
      await notifyMember(supportRequest, { response, resolved: supportRequest.status === "RESOLVED" });
    }

    await supportRequest.populate([
      { path: "memberId", select: "fullName phone" },
      { path: "createdBy", select: "email role" },
      { path: "respondedBy", select: "email role" },
    ]);

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
