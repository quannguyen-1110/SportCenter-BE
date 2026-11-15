const jwt = require("jsonwebtoken");

const User = require("../models/User");

// Verifies the JWT, then reloads role and status from the database so that a
// manager's role change or account lock takes effect on the very next request.
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }

  try {
    const user = await User.findById(decoded.userId).select("role status").lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Account no longer exists",
      });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Account is locked",
      });
    }

    req.user = {
      userId: String(user._id),
      role: user.role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = authMiddleware;
