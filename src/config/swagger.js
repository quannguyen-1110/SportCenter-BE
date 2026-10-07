const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",

    info: {
      title: "Sport Center Management API",
      version: "1.0.0",
      description:
        "API documentation for Sport Center Management System",
    },

    servers: [
      {
        url: "https://sportcenter-be.onrender.com",
        description: "Local development server",
      },
    ],

    tags: [
      {
        name: "Authentication",
        description: "Authentication APIs",
      },
      {
        name: "Members",
        description: "Member management APIs",
      },
      {
        name: "Coaches",
        description: "Coach management APIs",
      },
      {
        name: "Subjects",
        description: "Subject management APIs",
      },
      {
        name: "Classes",
        description: "Class management APIs",
      },
      {
        name: "Class Registrations",
        description: "Class registration APIs",
      },
      {
        name: "Attendances",
        description: "Attendance management APIs",
      },
      {
        name: "Payments",
        description: "Payment management APIs",
      },
      {
        name: "Workout Plans",
        description: "Workout plan management APIs",
      },
      {
        name: "Workout Results",
        description: "Workout result management APIs",
      },
      {
        name: "Notifications",
        description: "Notification management APIs",
      },
      {
        name: "Support Requests",
        description: "Support request management APIs",
      },
      {
        name: "Activity Logs",
        description: "Activity log management APIs",
      },
      {
        name: "Schedules",
        description: "Class schedules management APIs",
      },
      {
        name: "Courses",
        description: "Course management APIs"
      },
      {
        name: "Learning Paths",
        description: "Learning path management APIs"
      },
      {
        name: "Lessons",
        description: "Lesson management APIs"
      },
      {
        name: "Lesson Progress",
        description: "Lesson progress management APIs"
      },

      
    ],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },

  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;