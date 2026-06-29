/**
 * @fileoverview Complete unit tests for ConnectRequest Repository.
 * Targets 100% statement, function, condition, and branch passing coverage.
 */

// Mock the Mongoose schema models completely
jest.mock("../../../models/ConnectRequest", () => {
    const mockQuery = {
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
    };
    return {
        findOne: jest.fn().mockReturnThis(),
        find: jest.fn().mockReturnValue(mockQuery),
        findById: jest.fn().mockReturnThis(),
        create: jest.fn(),
        updateMany: jest.fn(),
        findByIdAndDelete: jest.fn(),
        // Re-expose for internal references
        _mockQuery: mockQuery
    };
});

jest.mock("../../../models/MentorProfile", () => ({
    findOne: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
}));

jest.mock("../../../models/MenteeProfile", () => ({
    findOne: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
}));

// Mock the core telemetry utility logger
jest.mock("../../../utils/logger", () => ({
    debug: jest.fn(),
}));

const ConnectRequest = require("../../../models/ConnectRequest");
const MentorProfile = require("../../../models/MentorProfile");
const MenteeProfile = require("../../../models/MenteeProfile");
const repository = require("../../../repositories/connectRequest.repository");

describe("ConnectRequest Repository (100% Comprehensive Coverage Mapping)", () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("READ Queries Matrix", () => {
        it("should call findOne with correct criteria inside findPendingRequest", async () => {
            ConnectRequest.findOne.mockResolvedValue({ _id: "req_1" });
            const res = await repository.findPendingRequest("u1", "m1");
            expect(ConnectRequest.findOne).toHaveBeenCalledWith({ mentee: "u1", mentor: "m1", status: "pending" });
            expect(res).toBeDefined();
        });

        it("should map array parameter keys properly inside findSlotConflict", async () => {
            const mockSlot = { date: "2026-07-06", startTime: "09:00", endTime: "10:00" };
            ConnectRequest.findOne.mockResolvedValue(null);

            await repository.findSlotConflict("mentor_abc", mockSlot);

            expect(ConnectRequest.findOne).toHaveBeenCalledWith(expect.objectContaining({
                mentor: "mentor_abc",
                "selectedSlots.date": "2026-07-06"
            }));
        });

        it("should find requests by primary tracking keys identifiers using findRequestById", async () => {
            ConnectRequest.findById.mockResolvedValue({ _id: "r1" });
            await repository.findRequestById("r1");
            expect(ConnectRequest.findById).toHaveBeenCalledWith("r1");
        });

        it("should invoke populated user details maps on mutable models inside findRequestByIdWithUsers", async () => {
            const mockPopulate = jest.fn().mockReturnThis();
            ConnectRequest.findById.mockReturnValue({ populate: mockPopulate });

            await repository.findRequestByIdWithUsers("r1");

            expect(ConnectRequest.findById).toHaveBeenCalledWith("r1");
            expect(mockPopulate).toHaveBeenCalledWith("mentee", "name email");
            expect(mockPopulate).toHaveBeenCalledWith("mentor", "name email");
        });

        it("should perform lean chain reads cleanly inside findRequestByIdLean", async () => {
            const mockLean = jest.fn().mockResolvedValue({});
            const mockPopulate2 = jest.fn().mockReturnValue({ lean: mockLean });
            const mockPopulate1 = jest.fn().mockReturnValue({ populate: mockPopulate2 });
            ConnectRequest.findById.mockReturnValue({ populate: mockPopulate1 });

            await repository.findRequestByIdLean("r1");
            expect(mockLean).toHaveBeenCalled();
        });

        it("should execute list builders sorted newest first inside findMyRequests", async () => {
            ConnectRequest._mockQuery.lean.mockResolvedValue([]);
            await repository.findMyRequests("mentee_1");

            expect(ConnectRequest.find).toHaveBeenCalledWith({ mentee: "mentee_1" });
            expect(ConnectRequest._mockQuery.select).toHaveBeenCalled();
            expect(ConnectRequest._mockQuery.sort).toHaveBeenCalledWith({ requestedAt: -1 });
        });

        it("should apply conditional filter criteria if provided status is a valid parameter inside findIncomingRequests", async () => {
            ConnectRequest._mockQuery.lean.mockResolvedValue([]);

            // Branch path 1: Valid accepted filter keyword token pass
            await repository.findIncomingRequests("mentor_1", "accepted");
            expect(ConnectRequest.find).toHaveBeenCalledWith({ mentor: "mentor_1", status: "accepted" });

            // Branch path 2: Disregarded or un-whitelisted parameter string layout fallback pass
            await repository.findIncomingRequests("mentor_1", "malicious_filter_bypass_keyword");
            expect(ConnectRequest.find).toHaveBeenLastCalledWith({ mentor: "mentor_1" });
        });

        it("should cross-reference multiple fields or conditions variables blocks inside findOngoingConnects", async () => {
            ConnectRequest._mockQuery.lean.mockResolvedValue([]);
            await repository.findOngoingConnects("user_abc");

            expect(ConnectRequest.find).toHaveBeenCalledWith(expect.objectContaining({
                $or: [{ mentee: "user_abc" }, { mentor: "user_abc" }]
            }));
        });
    });

    describe("PROFILE LOOKUPS Module Channels", () => {
        it("should restrict select projections to lightweight subset inside findMentorProfile", async () => {
            MentorProfile.findOne.mockReturnThis();
            MentorProfile.select.mockReturnThis();
            MentorProfile.lean.mockResolvedValue({ company: "Google" });

            const res = await repository.findMentorProfile("m1");
            expect(MentorProfile.findOne).toHaveBeenCalledWith({ user: "m1" });
            expect(MentorProfile.select).toHaveBeenCalledWith(expect.stringContaining("hourlyRate"));
            expect(res.company).toBe("Google");
        });

        it("should map expanded fields properties maps inside findMentorProfileFull", async () => {
            MentorProfile.findOne.mockReturnThis();
            MentorProfile.select.mockReturnThis();
            MentorProfile.lean.mockResolvedValue({ yearsOfExperience: 10 });

            await repository.findMentorProfileFull("m1");
            expect(MentorProfile.select).toHaveBeenCalledWith(expect.stringContaining("yearsOfExperience"));
        });

        it("should extract student details profiles metadata inside findMenteeProfile", async () => {
            MenteeProfile.findOne.mockReturnThis();
            MenteeProfile.select.mockReturnThis();
            MenteeProfile.lean.mockResolvedValue({ interestedFields: ["Tech"] });

            await repository.findMenteeProfile("e1");
            expect(MenteeProfile.findOne).toHaveBeenCalledWith({ user: "e1" });
        });
    });

    describe("WRITE Actions Persistence Layer Pipelines", () => {
        it("should create connect requests documents records inside createConnectRequest", async () => {
            const fakePayload = { mentor: "m1", mentee: "u1" };
            ConnectRequest.create.mockResolvedValue(fakePayload);

            await repository.createConnectRequest(fakePayload);
            expect(ConnectRequest.create).toHaveBeenCalledWith(fakePayload);
        });

        it("should invoke internal model save tracking side-effects parameters inside saveRequest", async () => {
            const mockRequestDoc = { _id: "r1", status: "pending", save: jest.fn().mockResolvedValue(true) };
            await repository.saveRequest(mockRequestDoc);
            expect(mockRequestDoc.save).toHaveBeenCalled();
        });

        it("should issue updateMany bulk operational mutations parameters inside rejectConflictingSlots", async () => {
            ConnectRequest.updateMany.mockResolvedValue({ modifiedCount: 3 });
            const confirmedSlot = { date: "2026-07-06", startTime: "09:00", endTime: "10:00" };

            await repository.rejectConflictingSlots("accepted_id", "mentor_1", confirmedSlot);

            expect(ConnectRequest.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({ _id: { $ne: "accepted_id" }, mentor: "mentor_1", status: "pending" }),
                expect.objectContaining({ $set: expect.objectContaining({ status: "rejected" }) })
            );
        });

        it("should hard delete rows inside deleteRequestById", async () => {
            ConnectRequest.findByIdAndDelete.mockResolvedValue({ _id: "deleted_id" });
            await repository.deleteRequestById("target_id");
            expect(ConnectRequest.findByIdAndDelete).toHaveBeenCalledWith("target_id");
        });
    });
});