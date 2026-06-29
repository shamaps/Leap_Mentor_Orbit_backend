const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/message.repository");
const Message = require("../../../models/Message"); // Migrated entirely to the actual production data model wrapper

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Message Repository (Integration)", () => {
    describe("markMessagesAsRead", () => {
        it("should flag outstanding inbound items as viewed while preserving outbound entries intact", async () => {
            const activeSession = new mongoose.Types.ObjectId();
            const meUser = new mongoose.Types.ObjectId();
            const partnerUser = new mongoose.Types.ObjectId();

            // Interacts with production schemas ensuring compliance with core content requirement paths
            await Message.create([
                { connectRequest: activeSession, sender: partnerUser, content: "Hello back!", readAt: null },
                { connectRequest: activeSession, sender: meUser, content: "Hey there!", readAt: null },
                { connectRequest: new mongoose.Types.ObjectId(), sender: partnerUser, content: "Ghost chat", readAt: null },
            ]);

            await repo.markMessagesAsRead(activeSession, meUser.toString());

            const targetCount = await Message.countDocuments({ connectRequest: activeSession, sender: partnerUser, readAt: { $ne: null } });
            expect(targetCount).toBe(1);

            const skippedCount = await Message.countDocuments({ connectRequest: activeSession, sender: meUser, readAt: null });
            expect(skippedCount).toBe(1);
        });
    });
});