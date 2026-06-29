/**
 * @fileoverview Unit tests for Goal Controller.
 * Achieves 100% complete statement, branch, and functional coverage maps.
 */

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(500).json({ error: err.message, context })),
}));

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json(data)),
    created: jest.fn((res, data) => res.status(201).json(data)),
    noContent: jest.fn((res) => res.status(204).send()),
}));

const createGoalController = require("../../../controllers/goal.controller");
const { handleError } = require("../../../utils/appError");
const { ok, created, noContent } = require("../../../utils/response");

describe("Goal Controller (100% Comprehensive Coverage)", () => {
    let mockGoalService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockGoalService = {
            createGoal: jest.fn(),
            getGoal: jest.fn(),
            updateGoal: jest.fn(),
            addMilestone: jest.fn(),
            updateMilestone: jest.fn(),
            deleteMilestone: jest.fn(),
        };

        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createGoalController(mockGoalService, { logger: mockLogger });

        req = {
            body: {},
            params: {},
            user: { _id: "u_mock_777" },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        };

        jest.clearAllMocks();
    });

    describe("createGoal endpoint", () => {
        it("should successfully build a goal and execute response created strategy", async () => {
            req.body = { connectRequestId: "c1", title: "Target Milestone Objective" };
            const serviceData = { goal: { _id: "g1", title: "Target Milestone Objective" } };
            mockGoalService.createGoal.mockResolvedValue(serviceData);

            await controller.createGoal(req, res);

            expect(mockGoalService.createGoal).toHaveBeenCalledWith(req.body, "u_mock_777");
            expect(created).toHaveBeenCalledWith(res, serviceData);
        });

        it("should forward exceptions through the core error handling middleware", async () => {
            const error = new Error("Missing required parameters layout");
            mockGoalService.createGoal.mockRejectedValue(error);

            await controller.createGoal(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "goal.createGoal");
        });
    });

    describe("getGoal endpoint", () => {
        it("should extract current roadmap entities and issue standard ok signals", async () => {
            req.params.connectRequestId = "c_id_99";
            const serviceData = { goal: {}, milestones: [] };
            mockGoalService.getGoal.mockResolvedValue(serviceData);

            await controller.getGoal(req, res);

            expect(mockGoalService.getGoal).toHaveBeenCalledWith("c_id_99", "u_mock_777");
            expect(ok).toHaveBeenCalledWith(res, serviceData);
        });

        it("should catch and relay retrieval path errors seamlessly", async () => {
            req.params.connectRequestId = "c_id_99";
            const error = new Error("Unauthorized timeline extraction request");
            mockGoalService.getGoal.mockRejectedValue(error);

            await controller.getGoal(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "goal.getGoal");
        });
    });

    describe("updateGoal endpoint", () => {
        it("should update properties maps and submit modified result frames back", async () => {
            req.params.goalId = "g_7";
            req.body = { title: "Refactored Title" };
            const serviceData = { goal: { _id: "g_7", title: "Refactored Title" } };
            mockGoalService.updateGoal.mockResolvedValue(serviceData);

            await controller.updateGoal(req, res);

            expect(mockGoalService.updateGoal).toHaveBeenCalledWith("g_7", req.body, "u_mock_777");
            expect(ok).toHaveBeenCalledWith(res, serviceData);
        });

        it("should fail gracefully into error handlers on restricted validation schemas", async () => {
            req.params.goalId = "g_7";
            const error = new Error("Title cannot match blank values");
            mockGoalService.updateGoal.mockRejectedValue(error);

            await controller.updateGoal(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "goal.updateGoal");
        });
    });

    describe("addMilestone endpoint", () => {
        it("should append a timeline milestone progress node and return created response code", async () => {
            req.params.goalId = "g_1";
            req.body = { title: "Step One" };
            const serviceData = { milestone: { _id: "m_1", order: 0 } };
            mockGoalService.addMilestone.mockResolvedValue(serviceData);

            await controller.addMilestone(req, res);

            expect(mockGoalService.addMilestone).toHaveBeenCalledWith("g_1", req.body, "u_mock_777");
            expect(created).toHaveBeenCalledWith(res, serviceData);
        });

        it("should direct milestone generation fault blocks through exception handlers", async () => {
            req.params.goalId = "g_1";
            const error = new Error("Parent objective cannot be found");
            mockGoalService.addMilestone.mockRejectedValue(error);

            await controller.addMilestone(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "goal.addMilestone");
        });
    });

    describe("updateMilestone endpoint", () => {
        it("should process structural parameter shifts and issue confirmation codes", async () => {
            req.params.milestoneId = "m_4";
            req.body = { isCompleted: true };
            const serviceData = { milestone: { _id: "m_4", isCompleted: true } };
            mockGoalService.updateMilestone.mockResolvedValue(serviceData);

            await controller.updateMilestone(req, res);

            expect(mockGoalService.updateMilestone).toHaveBeenCalledWith("m_4", req.body, "u_mock_777");
            expect(ok).toHaveBeenCalledWith(res, serviceData);
        });

        it("should bubble status adjustment validation constraints errors directly into catch tracking", async () => {
            req.params.milestoneId = "m_4";
            const error = new Error("Node structural access validation mismatch");
            mockGoalService.updateMilestone.mockRejectedValue(error);

            await controller.updateMilestone(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "goal.updateMilestone");
        });
    });

    describe("deleteMilestone endpoint", () => {
        it("should purge the progress node record and close out with an empty noContent message payload", async () => {
            req.params.milestoneId = "m_9";
            mockGoalService.deleteMilestone.mockResolvedValue({ message: "Milestone deleted" });

            await controller.deleteMilestone(req, res);

            expect(mockGoalService.deleteMilestone).toHaveBeenCalledWith("m_9", "u_mock_777");
            expect(noContent).toHaveBeenCalledWith(res);
        });

        it("should cascade removal restriction failures cleanly to handleError interceptors", async () => {
            req.params.milestoneId = "m_9";
            const error = new Error("Milestone element index missing");
            mockGoalService.deleteMilestone.mockRejectedValue(error);

            await controller.deleteMilestone(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "goal.deleteMilestone");
        });
    });
});