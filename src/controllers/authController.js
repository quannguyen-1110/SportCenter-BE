const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { OAuth2Client } = require("google-auth-library");
const {
  sendOTP,
  verifyOTP,
} = require("../services/otpService");

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

const register = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Email, password and role are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email: email.toLowerCase().trim(),
      passwordHash,
      role,
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        id: user._id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Register error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({
  email: email.toLowerCase().trim(),
}).select("+passwordHash");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Google ID token is required",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (
      !payload ||
      !payload.sub ||
      !payload.email ||
      payload.email_verified !== true
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid Google account",
      });
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase().trim();

    let user = await User.findOne({ googleId });

    if (!user) {
      const existingUser = await User.findOne({ email });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message:
            "An account with this email already exists. Please log in with email and password first.",
        });
      }

      user = await User.create({
        email,
        googleId,
        authProvider: "GOOGLE",
        role: "MEMBER",
        googleOtpVerified: false,
      });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    if (user.authProvider !== "GOOGLE") {
      return res.status(409).json({
        success: false,
        message: "This account does not use Google login",
      });
    }

    if (!user.googleOtpVerified) {
  await sendOTP(email);

  const challengeToken = jwt.sign(
    {
      purpose: "GOOGLE_OTP_VERIFICATION",
      userId: user._id.toString(),
      email: user.email,
    },
    process.env.GOOGLE_OTP_CHALLENGE_SECRET,
    { expiresIn: "5m" }
  );

  return res.status(200).json({
    success: true,
    requiresOTP: true,
    message: "OTP has been sent to your Google email",
    data: {
      email: user.email,
      challengeToken,
    },
  });
}

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      }
    );

    return res.status(200).json({
      success: true,
      requiresOTP: false,
      message: "Google login successful",
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
    });
  } catch (error) {
    console.error("Google login error:", error);

    if (error.message === "Please wait before requesting another OTP") {
      return res.status(429).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to complete Google login",
    });
  }
};


const verifyGoogleOTP = async (req, res) => {
  try {
    const { challengeToken, otp } = req.body;

    if (!challengeToken || !otp) {
      return res.status(400).json({
        success: false,
        message: "Challenge token and OTP are required",
      });
    }

    if (!/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({
        success: false,
        message: "OTP must contain 6 digits",
      });
    }

    let challenge;

    try {
      challenge = jwt.verify(
        challengeToken,
        process.env.GOOGLE_OTP_CHALLENGE_SECRET
      );
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Challenge token is invalid or expired",
      });
    }

    if (
      challenge.purpose !== "GOOGLE_OTP_VERIFICATION" ||
      !challenge.userId ||
      !challenge.email
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid OTP verification challenge",
      });
    }

    const normalizedEmail = challenge.email.toLowerCase().trim();

    const user = await User.findOne({
      _id: challenge.userId,
      email: normalizedEmail,
      googleId: { $exists: true, $ne: null },
      authProvider: "GOOGLE",
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Google account not found",
      });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    await verifyOTP(normalizedEmail, String(otp));

    user.googleOtpVerified = true;
    await user.save();

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      }
    );

    return res.status(200).json({
      success: true,
      message: "OTP verified. Google login successful",
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
    });
  } catch (error) {
    console.error("Verify Google OTP error:", error.message);

    const knownErrors = [
      "OTP is invalid or expired",
      "OTP is incorrect",
      "Too many incorrect attempts. Request a new OTP",
    ];

    if (knownErrors.includes(error.message)) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to verify OTP",
    });
  }
};


const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  register,
  login,
  googleLogin,
  verifyGoogleOTP,
  getMe,
};
