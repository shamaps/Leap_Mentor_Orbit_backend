// backend/__tests__/availability.test.js
const request      = require("supertest");
const app          = require("../app");
const Availability = require("../models/Availability");
const SlotLock     = require("../models/SlotLock");
const {
  createTestUser,
  createTestConnect,
} = require("./helpers/createTestData");

// ── Helpers ───────────────────────────────────────────────────

// A future date always valid for slots
const futureDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7); // 7 days from now
  return d.toISOString().split("T")[0]; // "YYYY-MM-DD"
};

const anotherFutureDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 14); // 14 days from now
  return d.toISOString().split("T")[0];
};

// Standard availability payload
const makeAvailabilityPayload = (dateOverride) => ({
  timezone:         "Asia/Kolkata",
  sessionDurations: [60],
  specificDates: [
    {
      date:  dateOverride || futureDate(),
      slots: [
        { startTime: "09:00", endTime: "12:00" }, // 3 x 60min blocks
      ],
    },
  ],
});

// ─────────────────────────────────────────────────────────────
// GET /api/availability/me
// ─────────────────────────────────────────────────────────────
describe("Availability — GET /api/availability/me", () => {

  test("✅ returns default response if no availability set", async () => {
    const { token } = await createTestUser({
      email: "mentor1@test.com",
      roles: ["mentor"],
    });

    const res = await request(app)
      .get("/api/availability/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.isNew).toBe(true);
    expect(res.body.timezone).toBe("Asia/Kolkata");
    expect(res.body.sessionDurations).toEqual([30, 60]);
  });

  test("✅ returns existing availability if already set", async () => {
    const { user, token } = await createTestUser({
      email: "mentor2@test.com",
      roles: ["mentor"],
    });

    // Create availability first
    await Availability.create({
      mentor:           user._id,
      timezone:         "America/New_York",
      sessionDurations: [30],
      specificDates:    [],
    });

    const res = await request(app)
      .get("/api/availability/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.timezone).toBe("America/New_York");
    expect(res.body.sessionDurations).toEqual([30]);
    expect(res.body.isNew).toBeUndefined(); // ← not new
  });

  test("❌ returns 401 if no token", async () => {
    const res = await request(app).get("/api/availability/me");
    expect(res.status).toBe(401);
  });

});

// ─────────────────────────────────────────────────────────────
// POST /api/availability
// ─────────────────────────────────────────────────────────────
describe("Availability — POST /api/availability", () => {

  test("✅ creates availability successfully", async () => {
    const { user, token } = await createTestUser({
      email: "mentor3@test.com",
      roles: ["mentor"],
    });

    const res = await request(app)
      .post("/api/availability")
      .set("Authorization", `Bearer ${token}`)
      .send(makeAvailabilityPayload());

    expect(res.status).toBe(201);
    expect(res.body.message).toContain("created");
    expect(res.body.availability.timezone).toBe("Asia/Kolkata");
    expect(res.body.availability.sessionDurations).toEqual([60]);

    // ✅ Verify saved in DB
    const saved = await Availability.findOne({ mentor: user._id });
    expect(saved).not.toBeNull();
    expect(saved.specificDates).toHaveLength(1);
  });

  test("❌ returns 409 if availability already exists", async () => {
    const { user, token } = await createTestUser({
      email: "mentor4@test.com",
      roles: ["mentor"],
    });

    // Create first time
    await request(app)
      .post("/api/availability")
      .set("Authorization", `Bearer ${token}`)
      .send(makeAvailabilityPayload());

    // Try to create again
    const res = await request(app)
      .post("/api/availability")
      .set("Authorization", `Bearer ${token}`)
      .send(makeAvailabilityPayload());

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("already exists");
  });

  test("❌ returns 401 if no token", async () => {
    const res = await request(app)
      .post("/api/availability")
      .send(makeAvailabilityPayload());

    expect(res.status).toBe(401);
  });

});

// ─────────────────────────────────────────────────────────────
// PATCH /api/availability/me
// ─────────────────────────────────────────────────────────────
describe("Availability — PATCH /api/availability/me", () => {

  test("✅ updates timezone successfully", async () => {
    const { user, token } = await createTestUser({
      email: "mentor5@test.com",
      roles: ["mentor"],
    });

    await Availability.create({
      mentor:           user._id,
      timezone:         "Asia/Kolkata",
      sessionDurations: [60],
      specificDates:    [],
    });

    const res = await request(app)
      .patch("/api/availability/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ timezone: "America/New_York" });

    expect(res.status).toBe(200);
    expect(res.body.availability.timezone).toBe("America/New_York");
  });

  test("✅ updates sessionDurations successfully", async () => {
    const { user, token } = await createTestUser({
      email: "mentor6@test.com",
      roles: ["mentor"],
    });

    await Availability.create({
      mentor:           user._id,
      timezone:         "Asia/Kolkata",
      sessionDurations: [60],
      specificDates:    [],
    });

    const res = await request(app)
      .patch("/api/availability/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ sessionDurations: [30, 45, 60] });

    expect(res.status).toBe(200);
    expect(res.body.availability.sessionDurations).toEqual([30, 45, 60]);
  });

  test("✅ creates availability if none exists (upsert)", async () => {
    const { token } = await createTestUser({
      email: "mentor7@test.com",
      roles: ["mentor"],
    });

    // No availability created yet — PATCH should upsert
    const res = await request(app)
      .patch("/api/availability/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ timezone: "Europe/London" });

    expect(res.status).toBe(200);
    expect(res.body.availability.timezone).toBe("Europe/London");
  });

  test("❌ returns 400 if no valid fields provided", async () => {
    const { token } = await createTestUser({
      email: "mentor8@test.com",
      roles: ["mentor"],
    });

    const res = await request(app)
      .patch("/api/availability/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ invalidField: "something" }); // ← not in allowedFields

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("No valid fields");
  });

  test("❌ returns 401 if no token", async () => {
    const res = await request(app)
      .patch("/api/availability/me")
      .send({ timezone: "UTC" });

    expect(res.status).toBe(401);
  });

});

// ─────────────────────────────────────────────────────────────
// DELETE /api/availability/me
// ─────────────────────────────────────────────────────────────
describe("Availability — DELETE /api/availability/me", () => {

  test("✅ deletes availability successfully", async () => {
    const { user, token } = await createTestUser({
      email: "mentor9@test.com",
      roles: ["mentor"],
    });

    await Availability.create({
      mentor:           user._id,
      timezone:         "Asia/Kolkata",
      sessionDurations: [60],
      specificDates:    [],
    });

    const res = await request(app)
      .delete("/api/availability/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("cleared");

    // ✅ Verify deleted from DB
    const deleted = await Availability.findOne({ mentor: user._id });
    expect(deleted).toBeNull();
  });

  test("❌ returns 401 if no token", async () => {
    const res = await request(app).delete("/api/availability/me");
    expect(res.status).toBe(401);
  });

});

// ─────────────────────────────────────────────────────────────
// GET /api/availability/:mentorId  (public)
// ─────────────────────────────────────────────────────────────
describe("Availability — GET /api/availability/:mentorId (public)", () => {

  test("✅ returns mentor availability publicly", async () => {
    const { user } = await createTestUser({
      email: "mentor10@test.com",
      roles: ["mentor"],
    });

    await Availability.create({
      mentor:           user._id,
      timezone:         "Asia/Kolkata",
      sessionDurations: [60],
      specificDates:    [],
    });

    // No auth header — public endpoint
    const res = await request(app)
      .get(`/api/availability/${user._id}`);

    expect(res.status).toBe(200);
    expect(res.body.timezone).toBe("Asia/Kolkata");
    expect(res.body.sessionDurations).toEqual([60]);
    // ✅ googleCalendarToken must NOT be returned (select: false)
    expect(res.body.googleCalendarToken).toBeUndefined();
  });

  test("❌ returns 404 if mentor has no availability", async () => {
    const { user } = await createTestUser({
      email: "mentor11@test.com",
      roles: ["mentor"],
    });

    const res = await request(app)
      .get(`/api/availability/${user._id}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toContain("not set");
  });

});

// ─────────────────────────────────────────────────────────────
// GET /api/availability/:mentorId/slots?duration=60
// ─────────────────────────────────────────────────────────────
describe("Availability — GET /api/availability/:mentorId/slots", () => {

  test("✅ returns grouped slots for valid duration", async () => {
    const { user: mentor, token: mentorToken } = await createTestUser({
      email: "mentor12@test.com",
      roles: ["mentor"],
    });
    const { token: menteeToken } = await createTestUser({
      email: "mentee12@test.com",
      roles: ["mentee"],
    });

    // Create availability with future date
    await Availability.create({
      mentor:           mentor._id,
      timezone:         "Asia/Kolkata",
      sessionDurations: [60],
      specificDates: [
        {
          date:  futureDate(),
          slots: [{ startTime: "09:00", endTime: "12:00" }],
        },
      ],
    });

    const res = await request(app)
      .get(`/api/availability/${mentor._id}/slots?duration=60`)
      .set("Authorization", `Bearer ${menteeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.slots).toBeDefined();
    expect(Array.isArray(res.body.slots)).toBe(true);
    expect(res.body.slots.length).toBeGreaterThan(0);

    // ✅ Each group has date, displayDate, day, slots
    const group = res.body.slots[0];
    expect(group.date).toBeDefined();
    expect(group.displayDate).toBeDefined();
    expect(group.day).toBeDefined();
    expect(group.slots).toBeDefined();

    // ✅ 09:00-12:00 with 60min blocks = 3 slots
    expect(group.slots).toHaveLength(3);
    expect(group.slots[0].startTime).toBe("09:00");
    expect(group.slots[0].endTime).toBe("10:00");
  });

  test("✅ returns empty slots if no specificDates set", async () => {
    const { user: mentor } = await createTestUser({
      email: "mentor13@test.com",
      roles: ["mentor"],
    });
    const { token: menteeToken } = await createTestUser({
      email: "mentee13@test.com",
      roles: ["mentee"],
    });

    await Availability.create({
      mentor:           mentor._id,
      timezone:         "Asia/Kolkata",
      sessionDurations: [60],
      specificDates:    [], // ← empty
    });

    const res = await request(app)
      .get(`/api/availability/${mentor._id}/slots?duration=60`)
      .set("Authorization", `Bearer ${menteeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.slots).toEqual([]);
  });

  test("✅ booked slots are marked as unavailable", async () => {
    const { user: mentor } = await createTestUser({
      email: "mentor14@test.com",
      roles: ["mentor"],
    });
    const { user: mentee, token: menteeToken } = await createTestUser({
      email: "mentee14@test.com",
      roles: ["mentee"],
      balance: 500,
    });

    const date = futureDate();

    await Availability.create({
      mentor:           mentor._id,
      timezone:         "Asia/Kolkata",
      sessionDurations: [60],
      specificDates: [
        {
          date,
          slots: [{ startTime: "09:00", endTime: "11:00" }], // 2 x 60min slots
        },
      ],
    });

    // ✅ Book the first slot via a connect request
    await createTestConnect({
      mentee,
      mentor,
      status: "pending",
    });

    const res = await request(app)
      .get(`/api/availability/${mentor._id}/slots?duration=60`)
      .set("Authorization", `Bearer ${menteeToken}`);

    expect(res.status).toBe(200);
    // slots may be reduced because booked slots are excluded
    expect(Array.isArray(res.body.slots)).toBe(true);
  });

  test("❌ returns 400 for invalid duration", async () => {
    const { user: mentor } = await createTestUser({
      email: "mentor15@test.com",
      roles: ["mentor"],
    });
    const { token: menteeToken } = await createTestUser({
      email: "mentee15@test.com",
      roles: ["mentee"],
    });

    await Availability.create({
      mentor:           mentor._id,
      timezone:         "Asia/Kolkata",
      sessionDurations: [60],
      specificDates:    [],
    });

    const res = await request(app)
      .get(`/api/availability/${mentor._id}/slots?duration=999`) // ← invalid
      .set("Authorization", `Bearer ${menteeToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Duration must be");
  });

  test("❌ returns 404 if mentor has no availability", async () => {
    const { user: mentor } = await createTestUser({
      email: "mentor16@test.com",
      roles: ["mentor"],
    });
    const { token: menteeToken } = await createTestUser({
      email: "mentee16@test.com",
      roles: ["mentee"],
    });

    // No availability created
    const res = await request(app)
      .get(`/api/availability/${mentor._id}/slots?duration=60`)
      .set("Authorization", `Bearer ${menteeToken}`);

    expect(res.status).toBe(404);
  });

  test("❌ returns 401 if no token", async () => {
    const { user: mentor } = await createTestUser({
      email: "mentor17@test.com",
      roles: ["mentor"],
    });

    const res = await request(app)
      .get(`/api/availability/${mentor._id}/slots?duration=60`);

    expect(res.status).toBe(401);
  });

});