// backend/__tests__/escrow.test.js
const request = require("supertest");
const app     = require("../app");
const Wallet  = require("../models/Wallet");
const {
  createTestUser,
  createTestConnect,
  createTestAdmin,   // ✅ added
} = require("./helpers/createTestData");

describe("Escrow Payment — POST /api/escrow/pay", () => {

  // ── Test 1: Successful payment ──────────────────────────────
  test("✅ deducts tokens from mentee and moves to escrow", async () => {

    // ✅ Admin must exist — escrow.controller calls getAdmin()
    await createTestAdmin({ commissionRate: 20 });

    // ── ARRANGE ───────────────────────────────────────────────
    const { user: mentee, token } = await createTestUser({
      email:   "mentee@test.com",
      roles:   ["mentee"],
      balance: 500, // ← enough to cover totalAmount + commission
    });
    const { user: mentor } = await createTestUser({
      email:   "mentor@test.com",
      roles:   ["mentor"],
      balance: 0,
    });
    const connect = await createTestConnect({
      mentee,
      mentor,
      status:       "accepted",
      sessionRate:  30,
      sessionCount: 2,
      totalAmount:  60,
    });

    // ── ACT ───────────────────────────────────────────────────
    const res = await request(app)
      .post("/api/escrow/pay")
      .set("Authorization", `Bearer ${token}`)
      .send({
        connectRequestId: connect._id,
        sessionRate:      30,
        sessionCount:     2,
      });

    // ── ASSERT ────────────────────────────────────────────────
    expect(res.status).toBe(200);
    expect(res.body.message).toContain("Payment successful");

    // ✅ Controller calculates: mentorAmount=60, platformFee=12 (20%), total=72
    // mentee started with 500 → 500 - 72 = 428
    const menteeWallet = await Wallet.findOne({ user: mentee._id });
    expect(menteeWallet.balance).toBe(428); // 500 - 72
    expect(menteeWallet.escrow).toBe(72);   // 60 + 12 platform fee
  });

  // ── Test 2: Insufficient balance ───────────────────────────
  test("❌ rejects if mentee has insufficient balance", async () => {

    // ✅ Admin must exist
    await createTestAdmin({ commissionRate: 20 });

    // ── ARRANGE ───────────────────────────────────────────────
    const { user: mentee, token } = await createTestUser({
      email:   "broke@test.com",
      roles:   ["mentee"],
      balance: 10,  // ← only 10 tokens, needs 72 (60 + 20% fee)
    });
    const { user: mentor } = await createTestUser({
      email:   "mentor2@test.com",
      roles:   ["mentor"],
      balance: 0,
    });
    const connect = await createTestConnect({
      mentee,
      mentor,
      status:       "accepted",
      sessionRate:  30,
      sessionCount: 2,
      totalAmount:  60,
    });

    // ── ACT ───────────────────────────────────────────────────
    const res = await request(app)
      .post("/api/escrow/pay")
      .set("Authorization", `Bearer ${token}`)
      .send({
        connectRequestId: connect._id,
        sessionRate:      30,
        sessionCount:     2,
      });

    // ── ASSERT ────────────────────────────────────────────────
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Insufficient balance");

    // ✅ Wallet should be completely unchanged
    const menteeWallet = await Wallet.findOne({ user: mentee._id });
    expect(menteeWallet.balance).toBe(10); // unchanged
    expect(menteeWallet.escrow).toBe(0);   // nothing moved
  });

  // ── Test 3: Duplicate payment ───────────────────────────────
  test("❌ rejects duplicate payment on same session", async () => {

    // ✅ Admin must exist
    await createTestAdmin({ commissionRate: 20 });

    // ── ARRANGE ───────────────────────────────────────────────
    const { user: mentee, token } = await createTestUser({
      email:   "mentee3@test.com",
      roles:   ["mentee"],
      balance: 500,
    });
    const { user: mentor } = await createTestUser({
      email:   "mentor3@test.com",
      roles:   ["mentor"],
      balance: 0,
    });
    // ✅ Already paid — status "ongoing", paymentStatus "paid"
    const connect = await createTestConnect({
      mentee,
      mentor,
      status:        "ongoing",
      paymentStatus: "paid",
    });

    // ── ACT ───────────────────────────────────────────────────
    const res = await request(app)
      .post("/api/escrow/pay")
      .set("Authorization", `Bearer ${token}`)
      .send({
        connectRequestId: connect._id,
        sessionRate:      30,
        sessionCount:     2,
      });

    // ── ASSERT ────────────────────────────────────────────────
    // ✅ Controller checks status !== "accepted" first → returns 400
    // because status is "ongoing" not "accepted"
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("accepted");
  });

});