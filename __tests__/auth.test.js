// backend/__tests__/auth.test.js
const request = require("supertest");
const app     = require("../app");
const User    = require("../models/User");
const Wallet  = require("../models/Wallet");

// ── Reusable register payload ─────────────────────────────────
const menteePayload = {
  name:          "Test Mentee",
  email:         "mentee@test.com",
  password:      "Password123",
  roles:         ["mentee"],
  termsAccepted: true,
};

const mentorPayload = {
  name:          "Test Mentor",
  email:         "mentor@test.com",
  password:      "Password123",
  roles:         ["mentor"],
  termsAccepted: true,
};

// ─────────────────────────────────────────────────────────────
// REGISTER TESTS
// ─────────────────────────────────────────────────────────────
describe("Auth — POST /api/auth/register", () => {

  // ── Success cases ─────────────────────────────────────────

  test("✅ registers new mentee — returns token + user + isNewUser true", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send(menteePayload);

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.isNewUser).toBe(true);
    expect(res.body.user.email).toBe("mentee@test.com");
    expect(res.body.user.password).toBeUndefined(); // ✅ sanitizeUser removes password
    expect(res.body.user.roles).toContain("mentee");
  });

  test("✅ mentee gets 500 token welcome bonus in wallet", async () => {
    await request(app).post("/api/auth/register").send(menteePayload);

    const user   = await User.findOne({ email: "mentee@test.com" });
    const wallet = await Wallet.findOne({ user: user._id });

    expect(wallet).not.toBeNull();
    expect(wallet.balance).toBe(500); // ✅ mentee welcome bonus
    expect(wallet.escrow).toBe(0);
  });

  test("✅ mentor gets 0 token wallet — no welcome bonus", async () => {
    await request(app).post("/api/auth/register").send(mentorPayload);

    const user   = await User.findOne({ email: "mentor@test.com" });
    const wallet = await Wallet.findOne({ user: user._id });

    expect(wallet).not.toBeNull();
    expect(wallet.balance).toBe(0); // ✅ mentor gets no bonus
    expect(wallet.escrow).toBe(0);
  });

  test("✅ existing user registers with new role — role added, isNewUser false", async () => {
    // First register as mentee
    await request(app).post("/api/auth/register").send(menteePayload);

    // Then register same email as mentor
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...menteePayload, roles: ["mentor"] });

    expect(res.status).toBe(200);
    expect(res.body.isNewUser).toBe(false);
    expect(res.body.user.roles).toContain("mentee");
    expect(res.body.user.roles).toContain("mentor"); // ✅ both roles now
  });

  test("✅ existing user registers with same role — no duplicate, isNewUser false", async () => {
    await request(app).post("/api/auth/register").send(menteePayload);

    const res = await request(app)
      .post("/api/auth/register")
      .send(menteePayload); // same payload again

    expect(res.status).toBe(200);
    expect(res.body.isNewUser).toBe(false);
    expect(res.body.message).toContain("Already registered");

    // ✅ roles should not be duplicated
    const user = await User.findOne({ email: "mentee@test.com" });
    expect(user.roles.filter((r) => r === "mentee").length).toBe(1);
  });

  // ── Validation failure cases ──────────────────────────────

  test("❌ returns 400 if name is missing", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...menteePayload, name: "" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("required");
  });

  test("❌ returns 400 if email is missing", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...menteePayload, email: "" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("required");
  });

  test("❌ returns 400 if password is missing", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...menteePayload, password: "" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("required");
  });

  test("❌ returns 400 if termsAccepted is false", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...menteePayload, termsAccepted: false });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("terms");
  });

  test("❌ returns 400 if roles is empty array", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...menteePayload, roles: [] });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("roles");
  });

  test("❌ returns 400 if role is invalid", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...menteePayload, roles: ["admin"] }); // ← not a valid role

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Invalid role");
  });

  test("❌ password is never returned in response", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send(menteePayload);

    expect(res.body.user.password).toBeUndefined();
  });

  test("❌ email is stored lowercase even if sent with capitals", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...menteePayload, email: "MENTEE@TEST.COM" });

    expect(res.status).toBe(201);

    const user = await User.findOne({ email: "mentee@test.com" });
    expect(user).not.toBeNull(); // ✅ stored as lowercase
  });

});

// LOGIN TESTS
describe("Auth — POST /api/auth/login", () => {

  // ── Register + verify a user before login tests ───────────
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send(menteePayload);

    // ✅ Manually verify email — login requires isEmailVerified: true
    await User.findOneAndUpdate(
      { email: "mentee@test.com" },
      { isEmailVerified: true }
    );
  });

  // ── Success cases ─────────────────────────────────────────

  test("✅ returns token + user on valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "mentee@test.com", password: "Password123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe("mentee@test.com");
    expect(res.body.message).toContain("Login successful");
  });

  test("✅ login works with uppercase email — case insensitive", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "MENTEE@TEST.COM", password: "Password123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test("✅ password is never returned in login response", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "mentee@test.com", password: "Password123" });

    expect(res.body.user.password).toBeUndefined();
  });

  // ── Failure cases ─────────────────────────────────────────

  test("❌ returns 401 on wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "mentee@test.com", password: "WrongPassword" });

    expect(res.status).toBe(401);
    expect(res.body.message).toContain("Invalid credentials");
  });

  test("❌ returns 401 if user does not exist", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@test.com", password: "Password123" });

    expect(res.status).toBe(401);
    expect(res.body.message).toContain("Invalid credentials");
  });

  test("❌ returns 403 if email not verified", async () => {
    // Register a new unverified user
    await request(app).post("/api/auth/register").send({
      ...menteePayload,
      email: "unverified@test.com",
    });
    // Do NOT verify email

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "unverified@test.com", password: "Password123" });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("verify your email");
    expect(res.body.isEmailVerified).toBe(false); // ✅ frontend uses this
  });

  test("❌ returns 400 if email is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ password: "Password123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("required");
  });

  test("❌ returns 400 if password is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "mentee@test.com" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("required");
  });

  test("❌ returns 400 if both email and password missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("required");
  });

});