/**
 * @fileoverview Unit tests for Goal Service.
 * Targets 100% comprehensive statement, function, and branch coverage.
 */

jest.mock("../../../socket/socketHandler", () => ({
    io: {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
    },
}));

jest.mock("../../../utils/mappers/goal.mapper", () => ({
    toGoalDTO: jest.fn((goal) => goal),
    toMilestoneDTO: jest.fn((milestone) => milestone),
}));

const createGoalService = require("../../../services/goal.service");
const socketHandler = require("../../../socket/socketHandler");
const AppError = require("../../../utils/appError");

describe("Goal Service (100% Comprehensive Coverage)", () => {
    let mockRepo, mockLogger, service;

    beforeEach(() => {
        mockRepo = {
            findSessionById: jest.fn(),
            findGoalBySession: jest.fn(),
            findGoalById: jest.fn(),
            findGoalByIdLean: jest.fn(),
            createGoal: jest.fn(),
            findMilestonesByGoal: jest.fn(),
            findLastMilestone: jest.fn(),
            findMilestoneById: jest.fn(),
            createMilestone: jest.fn(),
            deleteMilestoneById: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createGoalService(mockRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    describe("createGoal", () => {
        it("should throw AppError 400 if connectRequestId is missing", async () => {
            await expect(service.createGoal({ title: "Goal Title" }, "u1"))
                .rejects.toMatchObject({ status: 400, message: "connectRequestId is required" });
        });

        it("should throw AppError 400 if title is missing or empty space string", async () => {
            await expect(service.createGoal({ connectRequestId: "c1", title: "   " }, "u1"))
                .rejects.toMatchObject({ status: 400, message: "title is required" });
        });

        it("should throw AppError 404 if session does not exist", async () => {
            mockRepo.findSessionById.mockResolvedValue(null);
            await expect(service.createGoal({ connectRequestId: "c1", title: "Title" }, "u1"))
                .rejects.toMatchObject({ status: 404, message: "Session not found" });
        });

        it("should throw AppError 400 if session status is not ongoing", async () => {
            mockRepo.findSessionById.mockResolvedValue({ status: "completed" });
            await expect(service.createGoal({ connectRequestId: "c1", title: "Title" }, "u1"))
                .rejects.toMatchObject({ status: 400, message: "Goals can only be set for ongoing sessions" });
        });

        it("should throw AppError 403 if user is not a participant of the session", async () => {
            mockRepo.findSessionById.mockResolvedValue({ status: "ongoing", mentor: "m1", mentee: "e1" });
            await expect(service.createGoal({ connectRequestId: "c1", title: "Title" }, "unauthorized_user"))
                .rejects.toMatchObject({ status: 403, message: "Not authorized" });
        });

        it("should throw AppError 409 if a goal already exists for the target session", async () => {
            mockRepo.findSessionById.mockResolvedValue({ status: "ongoing", mentor: "m1", mentee: "e1" });
            mockRepo.findGoalBySession.mockResolvedValue({ _id: "existing_goal_id" });
            await expect(service.createGoal({ connectRequestId: "c1", title: "Title" }, "m1"))
                .rejects.toMatchObject({ status: 409, message: "A goal already exists for this session" });
        });

        it("should cleanly create a goal and dispatch room notifications on a valid payload context", async () => {
            mockRepo.findSessionById.mockResolvedValue({ status: "ongoing", mentor: "m1", mentee: "e1" });
            mockRepo.findGoalBySession.mockResolvedValue(null);
            mockRepo.createGoal.mockResolvedValue({ _id: "g1", title: "Title" });

            const res = await service.createGoal({ connectRequestId: "c1", title: "Title", description: "Desc" }, "m1");
            expect(mockRepo.createGoal).toHaveBeenCalled();
            expect(res.goal).toBeDefined();
        });
    });

    describe("getGoal", () => {
        it("should throw AppError 404 if session cannot be located", async () => {
            mockRepo.findSessionById.mockResolvedValue(null);
            await expect(service.getGoal("c1", "u1")).rejects.toMatchObject({ status: 404 });
        });

        it("should throw AppError 403 if a non-participant attempts retrieval", async () => {
            mockRepo.findSessionById.mockResolvedValue({ mentor: "m1", mentee: "e1" });
            await expect(service.getGoal("c1", "intruder")).rejects.toMatchObject({ status: 403 });
        });

        it("should return empty defaults if session matches but no goal is assigned yet", async () => {
            mockRepo.findSessionById.mockResolvedValue({ mentor: "m1", mentee: "e1" });
            mockRepo.findGoalBySession.mockResolvedValue(null);

            const res = await service.getGoal("c1", "m1");
            expect(res).toEqual({ goal: null, milestones: [] });
        });

        it("should return populated goal mapping summary contexts on matching records", async () => {
            mockRepo.findSessionById.mockResolvedValue({ mentor: "m1", mentee: "e1" });
            mockRepo.findGoalBySession.mockResolvedValue({ _id: "g1" });
            mockRepo.findMilestonesByGoal.mockResolvedValue([{ _id: "m_one" }]);

            const res = await service.getGoal("c1", "m1");
            expect(res.goal).toBeDefined();
            expect(res.milestones).toHaveLength(1);
        });
    });

    describe("updateGoal", () => {
        it("should throw AppError 404 if the goal does not exist", async () => {
            mockRepo.findGoalById.mockResolvedValue(null);
            await expect(service.updateGoal("g1", {}, "u1")).rejects.toMatchObject({ status: 404 });
        });

        it("should throw AppError 403 if a non-participant requests updates", async () => {
            mockRepo.findGoalById.mockResolvedValue({ connectRequest: "c1" });
            mockRepo.findSessionById.mockResolvedValue({ mentor: "m1", mentee: "e1" });
            await expect(service.updateGoal("g1", {}, "intruder")).rejects.toMatchObject({ status: 403 });
        });

        it("should throw AppError 400 if title update payload argument is passed empty", async () => {
            mockRepo.findGoalById.mockResolvedValue({ connectRequest: "c1" });
            mockRepo.findSessionById.mockResolvedValue({ mentor: "m1", mentee: "e1" });
            await expect(service.updateGoal("g1", { title: "   " }, "m1")).rejects.toMatchObject({ status: 400 });
        });

        it("should throw AppError 400 if status contains unknown keywords/enums mapping boundaries", async () => {
            mockRepo.findGoalById.mockResolvedValue({ connectRequest: "c1" });
            mockRepo.findSessionById.mockResolvedValue({ mentor: "m1", mentee: "e1" });
            await expect(service.updateGoal("g1", { status: "malicious_status_flag" }, "m1")).rejects.toMatchObject({ status: 400 });
        });

        it("should execute updates on all modified elements smoothly if parameters adhere to constraints", async () => {
            const mockGoalDoc = {
                connectRequest: "c1",
                title: "Old Title",
                description: "Old Desc",
                save: jest.fn().mockResolvedValue(true),
            };
            mockRepo.findGoalById.mockResolvedValue(mockGoalDoc);
            mockRepo.findSessionById.mockResolvedValue({ mentor: "m1", mentee: "e1" });

            const updates = { title: "New Title", description: "New Desc", startDate: new Date(), endDate: new Date(), status: "completed" };
            const res = await service.updateGoal("g1", updates, "m1");

            expect(mockGoalDoc.save).toHaveBeenCalled();
            expect(res.goal).toBeDefined();
        });
    });

    describe("addMilestone", () => {
        it("should throw AppError 404 if the target parent goal is missing", async () => {
            mockRepo.findGoalByIdLean.mockResolvedValue(null);
            await expect(service.addMilestone("g1", {}, "u1")).rejects.toMatchObject({ status: 404 });
        });

        it("should throw AppError 403 if verification checks fail participant rules", async () => {
            mockRepo.findGoalByIdLean.mockResolvedValue({ connectRequest: "c1" });
            mockRepo.findSessionById.mockResolvedValue({ mentor: "m1", mentee: "e1" });
            await expect(service.addMilestone("g1", {}, "stranger")).rejects.toMatchObject({ status: 403 });
        });

        it("should throw AppError 400 if title field is an empty clear string parameter", async () => {
            mockRepo.findGoalByIdLean.mockResolvedValue({ connectRequest: "c1" });
            mockRepo.findSessionById.mockResolvedValue({ mentor: "m1", mentee: "e1" });
            await expect(service.addMilestone("g1", { title: " " }, "m1")).rejects.toMatchObject({ status: 400 });
        });

        it("should successfully append milestone nodes, tracking sequential ordering indices accurately", async () => {
            mockRepo.findGoalByIdLean.mockResolvedValue({ _id: "g1", connectRequest: "c1" });
            mockRepo.findSessionById.mockResolvedValue({ mentor: "m1", mentee: "e1" });
            mockRepo.findLastMilestone.mockResolvedValue({ order: 4 });
            mockRepo.createMilestone.mockResolvedValue({ _id: "m2", title: "Milestone Text" });

            const res = await service.addMilestone("g1", { title: "Milestone Text" }, "m1");
            expect(mockRepo.createMilestone).toHaveBeenCalledWith(expect.objectContaining({ order: 5 }));
            expect(res.milestone).toBeDefined();
        });

        it("should assign sequence index order zero if it registers as the baseline milestone entry", async () => {
            mockRepo.findGoalByIdLean.mockResolvedValue({ _id: "g1", connectRequest: "c1" });
            mockRepo.findSessionById.mockResolvedValue({ mentor: "m1", mentee: "e1" });
            mockRepo.findLastMilestone.mockResolvedValue(null);
            mockRepo.createMilestone.mockResolvedValue({ _id: "m1" });

            await service.addMilestone("g1", { title: "Initial Node" }, "m1");
            expect(mockRepo.createMilestone).toHaveBeenCalledWith(expect.objectContaining({ order: 0 }));
        });
    });

    describe("updateMilestone", () => {
        it("should throw AppError 404 if tracking milestone does not resolve", async () => {
            mockRepo.findMilestoneById.mockResolvedValue(null);
            await expect(service.updateMilestone("m1", {}, "u1")).rejects.toMatchObject({ status: 404 });
        });

        it("should throw AppError 400 if title string parameters are updated empty", async () => {
            mockRepo.findMilestoneById.mockResolvedValue({ connectRequest: "c1" });
            mockRepo.findSessionById.mockResolvedValue({ mentor: "m1", mentee: "e1" });
            await expect(service.updateMilestone("m1", { title: "" }, "m1")).rejects.toMatchObject({ status: 400 });
        });

        it("should toggle milestone completion statuses and track verification audit timestamps", async () => {
            const mockMilestoneDoc = {
                connectRequest: "c1",
                save: jest.fn().mockResolvedValue(true),
            };
            mockRepo.findMilestoneById.mockResolvedValue(mockMilestoneDoc);
            mockRepo.findSessionById.mockResolvedValue({ mentor: "m1", mentee: "e1" });

            const res = await service.updateMilestone("m1", { isCompleted: true, title: "Valid Title", description: "Desc" }, "m1");
            expect(mockMilestoneDoc.isCompleted).toBe(true);
            expect(mockMilestoneDoc.completedAt).toBeInstanceOf(Date);
            expect(mockMilestoneDoc.completedBy).toBe("m1");
            expect(mockMilestoneDoc.save).toHaveBeenCalled();
            expect(res.milestone).toBeDefined();
        });

        it("should clear validation attributes cleanly if completion parameter is false", async () => {
            const mockMilestoneDoc = {
                connectRequest: "c1",
                save: jest.fn().mockResolvedValue(true),
            };
            mockRepo.findMilestoneById.mockResolvedValue(mockMilestoneDoc);
            mockRepo.findSessionById.mockResolvedValue({ mentor: "m1", mentee: "e1" });

            await service.updateMilestone("m1", { isCompleted: false }, "m1");
            expect(mockMilestoneDoc.completedAt).toBeNull();
            expect(mockMilestoneDoc.completedBy).toBeNull();
        });
    });

    describe("deleteMilestone", () => {
        it("should throw AppError 404 if entry cannot be extracted from tracking schemas", async () => {
            mockRepo.findMilestoneById.mockResolvedValue(null);
            await expect(service.deleteMilestone("m1", "u1")).rejects.toMatchObject({ status: 404 });
        });

        it("should safely destroy record instances on valid matches", async () => {
            mockRepo.findMilestoneById.mockResolvedValue({ _id: "m1", connectRequest: "c1" });
            mockRepo.findSessionById.mockResolvedValue({ mentor: "m1", mentee: "e1" });

            const res = await service.deleteMilestone("m1", "m1");
            expect(mockRepo.deleteMilestoneById).toHaveBeenCalledWith("m1");
            expect(res.message).toBe("Milestone deleted");
        });
    });

    describe("emitToRoom Error Isolation Boundary", () => {
        it("should log telemetry warnings via diagnostic logger if room string conversion throws structural exceptions", async () => {
            mockRepo.findSessionById.mockResolvedValue({ status: "ongoing", mentor: "m1", mentee: "e1" });

            // Force .toString() to break inside emitToRoom by sending a type that crashes on conversion execution paths
            const corruptPayload = {
                connectRequestId: {
                    toString: () => {
                        throw new Error("String serialization broken");
                    },
                },
                title: "Crash Trigger Test",
            };

            await service.createGoal(corruptPayload, "m1");
            expect(mockLogger.warn).toHaveBeenCalledWith("Socket emit failed", expect.any(Object));
        });
    });
});