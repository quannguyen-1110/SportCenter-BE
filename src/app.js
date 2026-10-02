const express = require("express");
const cors = require("cors");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

const authRoutes = require("./routes/authRoutes");
const memberRoutes = require("./routes/memberRoutes");
const coachRoutes = require("./routes/coachRoutes");
const subjectRoutes = require("./routes/subjectRoutes");
const classRoutes = require("./routes/classRoutes");
const classRegistrationRoutes = require("./routes/classRegistrationRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const workoutPlanRoutes = require("./routes/workoutPlanRoutes");
const workoutResultRoutes = require("./routes/workoutResultRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const supportRequestRoutes = require("./routes/supportRequestRoutes");
const activityLogRoutes = require("./routes/activityLogRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const scheduleRoutes = require("./routes/scheduleRoutes");
const courseRoutes = require("./routes/courseRoutes");
const learningPathRoutes = require("./routes/learningPathRoutes");
const lessonRoutes = require("./routes/lessonRoutes");
const lessonProgressRoutes = require("./routes/lessonProgressRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/coaches", coachRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/class-registrations", classRegistrationRoutes);
app.use("/api/attendances", attendanceRoutes);
app.use("/api/workout-plans", workoutPlanRoutes);
app.use("/api/workout-results", workoutResultRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/support-requests", supportRequestRoutes);
app.use("/api/activity-logs", activityLogRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/learning-paths", learningPathRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/lesson-progress", lessonProgressRoutes);


// Swagger
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec)
);

// Root API
app.get("/", (req, res) => {
  res.json({
    message: "Sport Center API is running",
  });
});

module.exports = app;