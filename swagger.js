// swagger.js
// mirror approach. Uses swagger-jsdoc to scan JSDoc @openapi comment blocks written
// directly above each route in routes/*.routes.js (and routes/admin/*.routes.js).
//
// Why this is better than a separate paths file:
//   The spec for a route lives in the SAME file as the route, directly above it.
//   If someone adds/changes an endpoint and forgets to update its doc comment,
//   the mismatch is visually obvious in code review — there's no second file to
//   remember to touch, and no risk of the doc silently drifting out of sync.
//
// Run with: npm run swagger
// Output:   ./swagger-output.json  (loaded by app.js at /api-docs)

const fs = require("node:fs");
const path = require("node:path");
const swaggerJsdoc = require("swagger-jsdoc");

const sharedSchemas = require("./swagger/_shared");

const info = {
  title: "LeapMentor API",
  version: "1.0.0",
  description: `REST API documentation for LeapMentor — a peer mentorship platform.

## Authentication
Most endpoints require a Bearer token in the \`Authorization\` header.
Admin endpoints use a separate admin token obtained via \`POST /api/v1/admin/auth/login\`.

## Base URL
All endpoints are prefixed with \`/api/v1\`

## Changelog
### v1.0.0 (current)
- Auth: register, OTP verification, login, password reset, Google OAuth, Clerk SSO
- Profiles: mentor & mentee profile creation and management
- Mentor Discovery: search and autocomplete
- Availability: mentor slot management
- Connect Requests: full lifecycle — send, respond, refer, cancel
- Slot Locking: optimistic concurrency control during booking
- Escrow: token-based payment flow — pay, release, refund
- Sessions: slot scheduling, meeting links, status transitions
- Goals & Milestones: per-session goal tracking
- Messages: real-time chat history (REST layer)
- Notes: shared and private note uploads
- Feedback: post-session ratings
- Reports: dispute management
- Notifications: in-app notification feed
- Push: Web Push subscription management
- Invoices: PDF invoice download
- Earnings: mentor payout dashboard
- Google Calendar: OAuth integration & busy-slot sync
- AI: Groq-powered help center proxy
- Admin: dashboard, analytics, user management, verifications, payments, reports, settings
- Support: help center message submission`,
};

const servers = [{ url: "http://localhost:5000/api/v1", description: "Local development" }];

const tags = [
  { name: "Auth", description: "Register, login, OTP verification, password reset, OAuth" },
  { name: "Verification", description: "Email OTP send / resend / verify" },
  { name: "Users", description: "Logged-in user's own account data" },
  { name: "MentorProfile", description: "Mentor profile CRUD" },
  { name: "MenteeProfile", description: "Mentee profile CRUD" },
  { name: "MentorSearch", description: "Search and autocomplete mentors" },
  { name: "Availability", description: "Mentor availability slot management" },
  { name: "SlotLock", description: "Temporary slot locking during booking flow" },
  { name: "ConnectRequest", description: "Mentee-Mentor connect request lifecycle" },
  { name: "Escrow", description: "Token-based escrow — pay, release, refund" },
  { name: "Session", description: "Session slots, meeting links, status transitions" },
  { name: "Goals", description: "Per-session goals and milestones" },
  { name: "Messages", description: "Chat message history (REST)" },
  { name: "Notes", description: "Shared and private session notes" },
  { name: "PrivateNotes", description: "Private per-user notes for a session" },
  { name: "Feedback", description: "Post-session feedback and ratings" },
  { name: "Reports", description: "Dispute / misconduct reports" },
  { name: "Notifications", description: "In-app notification feed" },
  { name: "Push", description: "Web Push subscription management" },
  { name: "Upload", description: "Profile picture and verification document upload" },
  { name: "Images", description: "Resized profile image proxy" },
  { name: "Invoices", description: "PDF invoice download" },
  { name: "Earnings", description: "Mentor earnings and payout history" },
  { name: "GoogleCalendar", description: "Google Calendar OAuth integration" },
  { name: "LeapRequests", description: "Mentee wallet top-up / leap requests" },
  { name: "Support", description: "Help center message submission" },
  { name: "AI", description: "Groq-powered AI help center proxy" },
  { name: "Admin", description: "Admin auth, stats, user management" },
  { name: "AdminPayments", description: "Admin payment stats and transaction history" },
  { name: "AdminReports", description: "Admin report management and refunds" },
  { name: "AdminVerifications", description: "Admin mentor verification approvals" },
  { name: "AdminSettings", description: "Admin settings, commission, admin accounts" },
];

const securitySchemes = {
  bearerAuth: {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "JWT access token obtained from login or refresh endpoints",
  },
};

const options = {
  definition: {
    openapi: "3.0.0",
    info,
    servers,
    tags,
    components: {
      securitySchemes,
      schemas: sharedSchemas,
    },
    security: [{ bearerAuth: [] }],
  },
  // swagger-jsdoc scans these files for /** @openapi ... */ comment blocks.
  // All 31 *.routes.js files (including the 4 admin* ones) live at the root of
  // routes/ — only routes/admin/index.js (a pure re-router with no JSDoc) is
  // inside the admin/ subfolder, so a single glob covers every annotated route.
  apis: [path.join(__dirname, "routes/*.routes.js")],
};

function buildSpec() {
  return swaggerJsdoc(options);
}

function main() {
  const spec = buildSpec();
  const outputFile = path.join(__dirname, "swagger-output.json");
  fs.writeFileSync(outputFile, JSON.stringify(spec, null, 2));

  const pathCount = Object.keys(spec.paths || {}).length;
  const operationCount = Object.values(spec.paths || {}).reduce(
    (sum, methods) => sum + Object.keys(methods).length,
    0
  );

  console.log(`✅ swagger-output.json written (${pathCount} paths, ${operationCount} operations)`);

  if (operationCount === 0) {
    console.warn(
      "⚠️  No operations found. Check that routes/*.routes.js files contain " +
      "/** @openapi ... */ JSDoc comment blocks above each route."
    );
  }
}

if (require.main === module) {
  main();
}

module.exports = { buildSpec };
