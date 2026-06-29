const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/mentorRefer.repository");
const { makeMentorUser, makeMentorProfile } = require("../../fixtures/createTestData");

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Mentor Referral Repository (Integration)", () => {
    describe("findSimilarMentors", () => {
        it("should query complete and published profiles matching intersecting skills while filtering out the host", async () => {
            const hostUser = new mongoose.Types.ObjectId();

            // Leverages centralized factories ensuring full compliance with production User required paths
            const peerUser1 = await makeMentorUser({ name: "Peer One", email: "peer1@test.com" });
            const peerUser2 = await makeMentorUser({ name: "Peer Two", email: "peer2@test.com" });

            await makeMentorProfile({ user: peerUser1._id, skills: ["GraphQL", "Redis"], isProfilePublished: true, isProfileComplete: true, currentRole: "Senior Engineer" });
            await makeMentorProfile({ user: peerUser2._id, skills: ["Redis"], isProfilePublished: false, isProfileComplete: true });
            await makeMentorProfile({ user: hostUser, skills: ["GraphQL"], isProfilePublished: true, isProfileComplete: true });

            const matches = await repo.findSimilarMentors(hostUser, ["GraphQL", "Redis"]);

            expect(matches).toHaveLength(1);
            expect(matches[0].user.name).toBe("Peer One");
            expect(matches[0].skills).toContain("GraphQL");
        });
    });
});