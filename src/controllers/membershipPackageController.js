const MembershipPackage = require("../models/MembershipPackage");

const createMembershipPackage = async (req, res) => {
  try {
    const { name, price, duration } = req.body;

    if (!name || price === undefined || !duration) {
      return res.status(400).json({
        success: false,
        message: "name, price and duration are required",
      });
    }

    if (price < 0 || duration < 1) {
      return res.status(400).json({
        success: false,
        message: "price must be >= 0 and duration must be >= 1",
      });
    }

    const membershipPackage = await MembershipPackage.create({
      name: name.trim(),
      price,
      duration,
    });

    return res.status(201).json({
      success: true,
      message: "Membership package created successfully",
      data: {
        id: membershipPackage._id,
        name: membershipPackage.name,
        price: membershipPackage.price,
        duration: membershipPackage.duration,
        createdAt: membershipPackage.createdAt,
      },
    });
  } catch (error) {
    console.error("Create membership package error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createMembershipPackage,
};