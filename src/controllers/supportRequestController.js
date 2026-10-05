const SupportRequest = require("../models/SupportRequest");
const Member = require("../models/Member");

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

// Get all support requests
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

module.exports = {
  createSupportRequest,
  getSupportRequests,
};