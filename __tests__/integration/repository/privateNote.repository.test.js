const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/privateNote.repository");
const PrivateNote = require("../../../models/PrivateNote"); // Swapped out faked schema definitions completely

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Private Note Repository (Integration)", () => {
    describe("findNotesByUser", () => {
        it("should extract private notebook arrays owned exclusively by the active caller user", async () => {
            const activeSessionId = new mongoose.Types.ObjectId();
            const meUserId = new mongoose.Types.ObjectId();
            const peerUserId = new mongoose.Types.ObjectId();

            await PrivateNote.create([
                { connectRequest: activeSessionId, author: meUserId, title: "My Private Note A", content: "Data stream A" },
                { connectRequest: activeSessionId, author: peerUserId, title: "Peer Private Note", content: "Data stream B" },
                { connectRequest: new mongoose.Types.ObjectId(), author: meUserId, title: "My Notes on alternative channel", content: "Data stream C" },
            ]);

            const notes = await repo.findNotesByUser(activeSessionId, meUserId);

            expect(notes).toHaveLength(1);
            expect(notes[0].title).toBe("My Private Note A");
            expect(notes[0].author.toString()).toBe(meUserId.toString());
        });
    });
});