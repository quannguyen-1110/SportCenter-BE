const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  let decoded;
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authHeader.split(" ")[1];

    decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
  if (!decoded || typeof decoded !== "object" || decoded.purpose || !mongoose.isValidObjectId(decoded.userId)) return res.status(401).json({ success: false, message: "Invalid account reference" });
  try {
    const user = await User.findById(decoded.userId).select("role status +tokenVersion");
    if (!user) return res.status(401).json({ success: false, message: "Account no longer exists" });
    if (user.status !== "ACTIVE") return res.status(403).json({ success: false, message: "Account is inactive" });
    if ((decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) return res.status(401).json({ success: false, message: "Session has been revoked; please sign in again" });
    req.user = { userId: user._id.toString(), role: user.role };
    return next();
  } catch (error) {
    return res.status(503).json({ success: false, message: "Could not verify account status" });
  }
};

module.exports = authMiddleware;
