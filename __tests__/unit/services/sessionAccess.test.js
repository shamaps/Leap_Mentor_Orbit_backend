const { validateSessionAccess } = require("../../../utils/sessionAccess");

describe("validateSessionAccess", () => {
    it("returns a promise and recognizes populated participant documents", async () => {
        const findParticipants = jest.fn().mockResolvedValue({
            mentor: { _id: "mentor-1", name: "Mentor" },
            mentee: "mentee-1",
            status: "ongoing",
        });

        const resultPromise = validateSessionAccess(findParticipants, "request-1", "mentor-1");
        expect(resultPromise).toBeInstanceOf(Promise);
        await expect(resultPromise).resolves.toEqual({
            valid: true,
            uploaderRole: "mentor",
            sessionStatus: "ongoing",
        });
    });
});
