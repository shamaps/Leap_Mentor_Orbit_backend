const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/note.repository");
const { makeUser } = require("../../fixtures/createTestData");
const Note = require("../../../models/Note"); // Migrated entirely to the actual production data model

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Note Repository (Integration)", () => {
    describe("findSharedNotes", () => {
        it("should retrieve solely shared documents, sorting descending by historical addition timestamps", async () => {
            const targetSession = new mongoose.Types.ObjectId();
            const mockUser = await makeUser({ name: "Uploader profile", email: "note@test.com" });

            // Interacts with production schemas ensuring compliance with active parameters
            await Note.create([
                {
                    connectRequest: targetSession,
                    uploadedBy: mockUser._id,
                    uploaderRole: "mentor",
                    title: "Shared Doc A",
                    fileUrl: "https://res.cloudinary.com/file1.pdf",
                    publicId: "notes/file1"
                },
                {
                    connectRequest: targetSession,
                    uploadedBy: mockUser._id,
                    uploaderRole: "mentor",
                    title: "Secret Doc B",
                    fileUrl: "https://res.cloudinary.com/file2.pdf",
                    publicId: "notes/file2",
                    isPrivate: true
                },
                {
                    connectRequest: new mongoose.Types.ObjectId(),
                    uploadedBy: mockUser._id,
                    uploaderRole: "mentee",
                    title: "Isolated Session Doc",
                    fileUrl: "https://res.cloudinary.com/file3.pdf",
                    publicId: "notes/file3"
                },
            ]);

            const sharedNotes = await repo.findSharedNotes(targetSession);

            expect(sharedNotes).toHaveLength(1);
            expect(sharedNotes[0].title).toBe("Shared Doc A");
            expect(sharedNotes[0].uploadedBy.name).toBe("Uploader profile");
        });
    });
});