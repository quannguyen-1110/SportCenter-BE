const MemberMembership = require("../models/MemberMembership");
const Member = require("../models/Member");
const MembershipPackage = require("../models/MembershipPackage");

const createMemberMembership = async (req, res) => {
  try {
    const { memberId, packageId, startDate } = req.body;

    if (!memberId || !packageId || !startDate) {
      return res.status(400).json({
        success: false,
        message: "memberId, packageId and startDate are required",
      });
    }

    const member = await Member.findById(memberId);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    const membershipPackage = await MembershipPackage.findById(packageId);

    if (!membershipPackage) {
      return res.status(404).json({
        success: false,
        message: "Membership package not found",
      });
    }

    const start = new Date(startDate);

    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid startDate",
      });
    }

    const end = new Date(start);
    end.setDate(end.getDate() + membershipPackage.duration);

    const memberMembership = await MemberMembership.create({
      memberId,
      packageId,
      startDate: start,
      endDate: end,
    });

    return res.status(201).json({
      success: true,
      message: "Member membership created successfully",
      data: {
        id: memberMembership._id,
        memberId: memberMembership.memberId,
        packageId: memberMembership.packageId,
        startDate: memberMembership.startDate,
        endDate: memberMembership.endDate,
        createdAt: memberMembership.createdAt,
      },
    });
  } catch (error) {
    console.error("Create member membership error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createMemberMembership,
};