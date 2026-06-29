jest.mock("../../../utils/generateInvoice", () => jest.fn().mockResolvedValue(Buffer.from("mock_pdf")));

const createInvoiceService = require("../../../services/invoice.service");
const generateInvoice = require("../../../utils/generateInvoice");

describe("Invoice Service (Unit)", () => {
    let mockRepo, mockLogger, service;

    beforeEach(() => {
        mockRepo = {
            findConnectRequestById: jest.fn(),
            findActiveAdminCommissionRate: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createInvoiceService(mockRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    it("should throw AppError 404 if parent connection lookup returns empty data states", async () => {
        mockRepo.findConnectRequestById.mockResolvedValue(null);

        await expect(service.downloadInvoice("invalid_id", "user_1"))
            .rejects.toMatchObject({ status: 404, message: "Session not found" });
    });

    it("should throw AppError 403 if the querying client userId mismatches the internal purchasing mentee identity", async () => {
        mockRepo.findConnectRequestById.mockResolvedValue({
            mentee: { _id: "authorized_mentee_id" }
        });

        await expect(service.downloadInvoice("req_id", "malicious_user_id"))
            .rejects.toMatchObject({ status: 403, message: "Not authorized to download this invoice" });
    });

    it("should throw AppError 400 if target billing records do not map to supported paid flags states", async () => {
        mockRepo.findConnectRequestById.mockResolvedValue({
            mentee: { _id: "mentee_1" },
            paymentStatus: "unpaid"
        });

        await expect(service.downloadInvoice("req_id", "mentee_1"))
            .rejects.toMatchObject({ status: 400, message: "No paid invoice found for this session" });
    });

    it("should throw AppError 400 if platform operational percentages are missing inside corporate parameters configurations", async () => {
        mockRepo.findConnectRequestById.mockResolvedValue({
            mentee: { _id: "mentee_1" },
            paymentStatus: "paid"
        });
        mockRepo.findActiveAdminCommissionRate.mockResolvedValue(null);

        await expect(service.downloadInvoice("req_id", "mentee_1"))
            .rejects.toMatchObject({ status: 400, message: "Platform commission rate not configured" });
    });

    it("should successfully generate invoice instances upon satisfying all logical guards variables", async () => {
        const mockRequest = {
            _id: "665f1c2e4b1a2c001f8e9a44",
            mentee: { _id: "m_1", name: "Alice", email: "alice@test.com" },
            mentor: { _id: "mt_1", name: "Bob", email: "bob@test.com" },
            paymentStatus: "released",
            selectedSlots: [],
            confirmedSlot: {},
            sessionRate: 25,
            sessionCount: 4,
            totalAmount: 110,
            paidAt: new Date()
        };
        mockRepo.findConnectRequestById.mockResolvedValue(mockRequest);
        mockRepo.findActiveAdminCommissionRate.mockResolvedValue({ commissionRate: 10 });

        const result = await service.downloadInvoice("665f1c2e4b1a2c001f8e9a44", "m_1");

        expect(result.invoiceNumber).toBe("INV-8E9A44");
        expect(generateInvoice).toHaveBeenCalledWith(expect.objectContaining({
            invoiceNumber: "INV-8E9A44",
            platformFeePercent: 10,
            totalAmount: 110,
        }));
        expect(Buffer.isBuffer(result.pdfBuffer)).toBe(true);
    });
});