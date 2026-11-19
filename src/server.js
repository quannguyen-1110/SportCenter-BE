require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");
const { startReminderJob } = require("./jobs/reminderJob");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  startReminderJob();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
  });
};

startServer();
