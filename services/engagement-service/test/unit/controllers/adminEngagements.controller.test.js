/**
 * @fileoverview Unit tests for the Admin Engagements Controller.
 */

jest.mock("@leapmentor/shared/utils/response", () => ({ ok: jest.fn() }));
jest.mock("@leapmentor/shared/utils/appError", () => ({ handleError: jest.fn() }));

const createAdminEngagementsController = require("../../../src/controllers/admin/adminEngagements.controller");
const { ok } = require("@leapmentor/shared/utils/response");
const { handleError } = require("@leapmentor/shared/utils/appError");

describe("Admin Engagements Controller", () => {
    let service, logger, controller, req, res;

    beforeEach(() => {
        service = { fetchEngagementStats: jest.fn(), fetchEngagements: jest.fn() };
        logger = { info: jest.fn() };
        controller = createAdminEngagementsController(service, { logger });
        req = { query: { status: "ongoing", page: "2" } };
        res = {};
        jest.clearAllMocks();
    });

    describe("getEngagementStats", () => {
        it("should return the stats and log success", async () => {
            service.fetchEngagementStats.mockResolvedValue({ total: 3 });

            await controller.getEngagementStats(req, res);

            expect(ok).toHaveBeenCalledWith(res, { total: 3 });
            expect(logger.info).toHaveBeenCalledWith("getEngagementStats completed successfully");
        });

        it("should pass a service failure to handleError", async () => {
            const err = new Error("stats failed");
            service.fetchEngagementStats.mockRejectedValue(err);

            await controller.getEngagementStats(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "getEngagementStats");
            expect(ok).not.toHaveBeenCalled();
        });
    });

    describe("getEngagements", () => {
        it("should hand the query string to the service as the filter options", async () => {
            service.fetchEngagements.mockResolvedValue({ engagements: [] });

            await controller.getEngagements(req, res);

            expect(service.fetchEngagements).toHaveBeenCalledWith({ status: "ongoing", page: "2" });
            expect(ok).toHaveBeenCalledWith(res, { engagements: [] });
            expect(logger.info).toHaveBeenCalledWith("getEngagements completed successfully");
        });

        it("should pass a service failure to handleError", async () => {
            const err = new Error("list failed");
            service.fetchEngagements.mockRejectedValue(err);

            await controller.getEngagements(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "getEngagements");
            expect(ok).not.toHaveBeenCalled();
        });
    });
});
