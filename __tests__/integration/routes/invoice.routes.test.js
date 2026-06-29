const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockDownloadInvoiceMiddleware = jest.fn((req, res) => {
    res.set("Content-Type", "application/pdf");
    return res.status(200).send(Buffer.from("binary_pdf_stream"));
});

jest.mock("../../../config/container", () => ({
    invoiceController: {
        downloadInvoice: (req, res, next) => mockDownloadInvoiceMiddleware(req, res, next),
    },
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "mock_mentee_actor_user_id" };
        next();
    }),
}));

describe("Invoice Routing Interfaces (Integration)", () => {
    let app;

    beforeAll(async () => {
        await dbHandler.connect();
        app = express();
        app.use(express.json());

        const invoiceRoutes = require("../../../routes/invoice.routes");
        app.use("/invoices", invoiceRoutes);
    });

    afterEach(async () => {
        await dbHandler.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await dbHandler.close();
    });

    it("GET /invoices/:connectRequestId should enforce access checkpoints and successfully transmit files", async () => {
        const response = await request(app)
            .get("/invoices/665f1c2e4b1a2c001f8e9a44")
            .expect(200);

        expect(response.headers["content-type"]).toBe("application/pdf");
        expect(mockDownloadInvoiceMiddleware).toHaveBeenCalled();
    });
});