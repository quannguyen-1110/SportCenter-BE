const SupportRequest = require("../models/SupportRequest");

const Member = require("../models/Member");

// CREATE support request
const createSupportRequest = async (req, res) => {
  try {
    const { memberId, message } = req.body;

    if (!memberId || !message) {
      return res.status(400).json({
        success: false,
        message: "memberId and message are required",
      });
    }

    const member = await Member.findById(memberId);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    const supportRequest = await SupportRequest.create({
      memberId,
      message: message.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Support request created successfully",
      data: {
        id: supportRequest._id,
        memberId: supportRequest.memberId,
        message: supportRequest.message,
        status: supportRequest.status,
        createdAt: supportRequest.createdAt,
      },
    });
  } catch (error) {
    console.error("Create support request error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET all support requests
const getSupportRequests = async (req, res) => {
  try {
    const supportRequests = await SupportRequest.find()
      .populate(
        "memberId",
        "fullName phone goal level"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Support requests retrieved successfully",
      data: supportRequests,
    });
  } catch (error) {
    console.error("Get support requests error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// UPDATE support request
const updateSupportRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "status is required",
      });
    }

    if (!["PENDING", "RESOLVED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid support request status",
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

    return res.status(200).json({
      success: true,
      message: "Support request updated successfully",
      data: {
        id: supportRequest._id,
        memberId: supportRequest.memberId,
        message: supportRequest.message,
        status: supportRequest.status,
        updatedAt: supportRequest.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update support request error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createSupportRequest,
  getSupportRequests,
  updateSupportRequest,
};