jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createInvoiceController = require("../../../controllers/invoice.controller");
const { handleError } = require("../../../utils/appError");

describe("Invoice Controller (Unit)", () => {
    let mockInvoiceService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockInvoiceService = { downloadInvoice: jest.fn() };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createInvoiceController(mockInvoiceService, { logger: mockLogger });

        req = { params: { connectRequestId: "req_invoice_123" }, user: { _id: "user_mentee_999" } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            set: jest.fn(),
            send: jest.fn(),
        };
        jest.clearAllMocks();
    });

    it("should stream binary buffers with standard Content-Disposition attachments on success", async () => {
        const fakePdfBuffer = Buffer.from("%PDF-1.4 mock binary string data content %EOF");
        mockInvoiceService.downloadInvoice.mockResolvedValue({
            pdfBuffer: fakePdfBuffer,
            invoiceNumber: "A1B2C3",
        });

        await controller.downloadInvoice(req, res);

        expect(mockInvoiceService.downloadInvoice).toHaveBeenCalledWith("req_invoice_123", "user_mentee_999");
        expect(res.set).toHaveBeenCalledWith({
            "Content-Type": "application/pdf",
            "Content-Disposition": 'attachment; filename="Invoice-A1B2C3.pdf"',
            "Content-Length": fakePdfBuffer.length,
        });
        expect(res.send).toHaveBeenCalledWith(fakePdfBuffer);
    });

    it("should safely channel execution errors down into fallback error handling frameworks", async () => {
        const testError = new Error("Buffer streaming allocation failure");
        mockInvoiceService.downloadInvoice.mockRejectedValue(testError);

        await controller.downloadInvoice(req, res);

        expect(handleError).toHaveBeenCalledWith(res, testError, "invoice.downloadInvoice");
    });
});