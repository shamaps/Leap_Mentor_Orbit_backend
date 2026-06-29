const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/pushSubscription.repository");
const PushSubscription = require("../../../models/PushSubscription"); // Replaces hand-rolled mini schemas

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Push Subscription Repository (Integration)", () => {
    describe("upsertSubscription", () => {
        it("should insert fresh elements or perform selective updates over compound matching indices safely", async () => {
            const mockUser = new mongoose.Types.ObjectId();
            const payloadSub = { endpoint: "https://fcm.com/abc", keys: { p256dh: "p", auth: "a" } };

            await repo.upsertSubscription(mockUser, payloadSub);

            const recordCount = await PushSubscription.countDocuments({ user: mockUser });
            expect(recordCount).toBe(1);

            // Trigger second sequential execution pass to assert upsert compound index overrides work flawlessly
            await repo.upsertSubscription(mockUser, payloadSub);
            const postUpsertCount = await PushSubscription.countDocuments({ user: mockUser });
            expect(postUpsertCount).toBe(1);
        });
    });
});