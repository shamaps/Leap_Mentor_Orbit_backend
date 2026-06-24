// swagger-gen.js
const swaggerAutogen = require("swagger-autogen")({ openapi: "3.0.0" });

const doc = {
  info: {
    title: "LeapMentor API",
    description: "Full API documentation for the LeapMentor mentorship platform",
    version: "1.0.0",
  },
  servers: [
    { url: "http://localhost:5000", description: "Local development" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      // ── Auth 
      RegisterBody: {
        type: "object",
        required: ["name", "email", "password", "roles", "termsAccepted"],
        properties: {
          name: { type: "string", example: "John Doe" },
          email: { type: "string", example: "john@example.com" },
          password: { type: "string", example: "SecurePass123!" },
          roles: { type: "array", items: { type: "string", enum: ["mentor", "mentee"] } },
          termsAccepted: { type: "boolean", example: true },
        },
      },
      LoginBody: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", example: "john@example.com" },
          password: { type: "string", example: "SecurePass123!" },
        },
      },
      // ── Connect Request 
      ConnectRequestBody: {
        type: "object",
        required: ["mentorId", "selectedSlots"],
        properties: {
          mentorId: { type: "string", example: "64f2a3b1c9e4a5d600000001" },
          message: { type: "string", example: "I'd like to learn backend architecture" },
          sessionRate: { type: "number", example: 500 },
          sessionCount: { type: "number", example: 3 },
          selectedSlots: {
            type: "array",
            items: {
              type: "object",
              properties: {
                day: { type: "string", example: "Monday" },
                date: { type: "string", example: "2025-07-07" },
                startTime: { type: "string", example: "10:00" },
                endTime: { type: "string", example: "11:00" },
              },
            },
          },
        },
      },
      // ── Escrow
      PayBody: {
        type: "object",
        required: ["connectRequestId"],
        properties: {
          connectRequestId: { type: "string", example: "64f2a3b1c9e4a5d600000002" },
        },
      },
      EscrowActionBody: {
        type: "object",
        required: ["action"],
        properties: {
          action: { type: "string", enum: ["release", "refund"], example: "release" },
        },
      },
      // ── Feedback 
      FeedbackBody: {
        type: "object",
        required: ["connectRequestId", "rating"],
        properties: {
          connectRequestId: { type: "string" },
          rating: { type: "number", minimum: 1, maximum: 5, example: 5 },
          comment: { type: "string", example: "Great mentor!" },
          slotIndex: { type: "number", example: 0 },
        },
      },
      // ── Report 
      ReportBody: {
        type: "object",
        required: ["connectRequestId", "reportedUserId", "complaintType", "description"],
        properties: {
          connectRequestId: { type: "string" },
          reportedUserId: { type: "string" },
          complaintType: {
            type: "string",
            enum: ["inappropriate_behavior", "session_misconduct", "fake_credentials", "spam_scam", "refund", "other"],
          },
          description: { type: "string", example: "Mentor did not show up for the session." },
        },
      },
      // ── Goal
      GoalBody: {
        type: "object",
        required: ["connectRequestId", "title"],
        properties: {
          connectRequestId: { type: "string" },
          title: { type: "string", example: "Master Node.js internals" },
          description: { type: "string" },
          startDate: { type: "string", example: "2025-07-01" },
          endDate: { type: "string", example: "2025-09-01" },
        },
      },
      MilestoneBody: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string", example: "Complete event loop deep-dive" },
          description: { type: "string" },
          dueDate: { type: "string", example: "2025-07-20" },
          slotIndex: { type: "number" },
        },
      },
      // ── Support ─────────────────────────────────
      SupportMessageBody: {
        type: "object",
        required: ["email", "subject", "message"],
        properties: {
          email: { type: "string", example: "user@example.com" },
          subject: { type: "string", example: "Payment issue" },
          message: { type: "string", example: "I was charged but session was not booked." },
          role: { type: "string", enum: ["mentor", "mentee", "user"] },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  // Tags define the groups visible in Swagger UI sidebar
  tags: [
    { name: "Auth", description: "Register, login, OAuth, token refresh, password" },
    { name: "Verification", description: "Email OTP verification" },
    { name: "Users", description: "Logged-in user info" },
    { name: "Mentor Profile", description: "Create and manage mentor profile" },
    { name: "Mentee Profile", description: "Create and manage mentee profile" },
    { name: "Mentor Search", description: "Search and discover mentors" },
    { name: "Availability", description: "Mentor availability and slot management" },
    { name: "Connect Requests", description: "Send, respond to, and manage session requests" },
    { name: "Slot Locks", description: "Temporary slot reservations during booking" },
    { name: "Sessions", description: "Session slots, meeting links, completion marking" },
    { name: "Escrow", description: "Payments, wallet, escrow hold and release" },
    { name: "Invoices", description: "Download payment invoices" },
    { name: "Messages", description: "In-session chat messages" },
    { name: "Notes", description: "Shared session notes and file uploads" },
    { name: "Private Notes", description: "Personal notes visible only to the author" },
    { name: "Goals", description: "Session goals and milestones" },
    { name: "Feedback", description: "Post-session feedback and ratings" },
    { name: "Reports", description: "Dispute and misconduct reports" },
    { name: "Notifications", description: "In-app notifications" },
    { name: "Earnings", description: "Mentor earnings summary and payout history" },
    { name: "Google Calendar", description: "Google Calendar OAuth integration" },
    { name: "Upload", description: "Profile picture and document uploads" },
    { name: "AI", description: "LeapBuddy AI chat proxy" },
    { name: "Support", description: "Help Centre support messages" },
    { name: "Leap Requests", description: "Mentor wallet top-up requests" },
    { name: "Push Notifications", description: "Web push subscription management" },
    { name: "Admin — Auth", description: "Admin login and session" },
    { name: "Admin — Users", description: "User management" },
    { name: "Admin — Stats", description: "Platform statistics and charts" },
    { name: "Admin — Engagements", description: "Connect request engagement tracking" },
    { name: "Admin — Payments", description: "Revenue, transactions, escrow" },
    { name: "Admin — Reports", description: "Dispute resolution" },
    { name: "Admin — Verifications", description: "Mentor profile verification" },
    { name: "Admin — Settings", description: "Commission rate, admin management" },
    { name: "Admin — Leap Requests", description: "Wallet top-up approvals" },
    { name: "Images", description: "Resized Cloudinary profile images" },
  ],
};

const outputFile = "./swagger-output.json";
const routeFiles = ["./app.js"];

swaggerAutogen(outputFile, routeFiles, doc);