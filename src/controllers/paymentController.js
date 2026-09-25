const Payment = require("../models/Payment");
const MemberMembership = require("../models/MemberMembership");

const createPayment = async (req, res) => {
  try {
    const { memberMembershipId, amount, paymentDate } = req.body;

    if (!memberMembershipId || amount === undefined || !paymentDate) {
      return res.status(400).json({
        success: false,
        message:
          "memberMembershipId, amount and paymentDate are required",
      });
    }

    if (amount < 0) {
      return res.status(400).json({
        success: false,
        message: "amount must be >= 0",
      });
    }

    const memberMembership =
      await MemberMembership.findById(memberMembershipId);

    if (!memberMembership) {
      return res.status(404).json({
        success: false,
        message: "Member membership not found",
      });
    }

    const paymentDateValue = new Date(paymentDate);

    if (Number.isNaN(paymentDateValue.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid paymentDate",
      });
    }

    const payment = await Payment.create({
      memberMembershipId,
      amount,
      paymentDate: paymentDateValue,
    });

    return res.status(201).json({
      success: true,
      message: "Payment created successfully",
      data: {
        id: payment._id,
        memberMembershipId: payment.memberMembershipId,
        amount: payment.amount,
        paymentDate: payment.paymentDate,
        createdAt: payment.createdAt,
      },
    });
  } catch (error) {
    console.error("Create payment error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createPayment,
};