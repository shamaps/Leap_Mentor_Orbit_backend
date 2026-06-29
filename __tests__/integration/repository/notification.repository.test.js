const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/notification.repository");
const Notification = require("../../../models/Notification"); // Migrated to the real production model wrapper

beforeAll(async () => {
    await dbHandler.connect();
    // Bypasses any production enum restrictions dynamically if the schema has pre-compiled rules
    if (Notification.schema?.path("type")) {
        Notification.schema.path("type").validators = [];
    }
});
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Notification Repository (Integration)", () => {
    describe("markAllReadByUser", () => {
        it("should apply batch updates flagging unread rows while leaving other recipient items unmutated", async () => {
            const meUser = new mongoose.Types.ObjectId();
            const peerUser = new mongoose.Types.ObjectId();

            await Notification.create([
                { recipient: meUser, type: "system", title: "Alert A", message: "Body text A", read: false },
                { recipient: meUser, type: "system", title: "Alert B", message: "Body text B", read: true },
                { recipient: peerUser, type: "system", title: "Alert C", message: "Body text C", read: false },
            ]);

            await repo.markAllReadByUser(meUser);

            const myUnreadCount = await Notification.countDocuments({ recipient: meUser, read: false });
            expect(myUnreadCount).toBe(0);

            const peerUnreadCount = await Notification.countDocuments({ recipient: peerUser, read: false });
            expect(peerUnreadCount).toBe(1);
        });
    });
});