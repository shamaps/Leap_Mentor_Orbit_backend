/**
 * @fileoverview Unit tests for Google Calendar Repository.
 * Reaches 100% statement, line, function, and branch coverage.
 */

// Mock the Mongoose schema dependencies completely
jest.mock("../../../models/Availability", () => {
    const mockQuery = {
        select: jest.fn(),
    };
    return {
        findOne: jest.fn(() => mockQuery),
        findOneAndUpdate: jest.fn(),
        // Re-expose for internal spy references
        _mockQuery: mockQuery
    };
});

// Mock the crypto utility functions cleanly
jest.mock("../../../utils/tokenCrypto", () => ({
    encrypt: jest.fn((val) => `encrypted_${val}`),
    decrypt: jest.fn((val) => val.replace("encrypted_", "")),
}));

const Availability = require("../../../models/Availability");
const { encrypt, decrypt } = require("../../../utils/tokenCrypto");
const repository = require("../../../repositories/googleCalendar.repository");

describe("Google Calendar Repository (100% Comprehensive Coverage)", () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("findAvailabilityWithToken", () => {
        it("should successfully fetch visibility records and decrypt the token if it exists", async () => {
            const fakeDoc = {
                mentor: "m_123",
                googleCalendarToken: "encrypted_plain_json_token"
            };
            Availability._mockQuery.select.mockResolvedValue(fakeDoc);

            const result = await repository.findAvailabilityWithToken("m_123");

            expect(Availability.findOne).toHaveBeenCalledWith({ mentor: "m_123" });
            expect(Availability._mockQuery.select).toHaveBeenCalledWith("+googleCalendarToken");
            expect(decrypt).toHaveBeenCalledWith("encrypted_plain_json_token");
            expect(result.googleCalendarToken).toBe("plain_json_token");
        });

        it("should bypass the decryption wrapper cleanly if the document or token field is missing", async () => {
            const fakeDoc = { mentor: "m_123", googleCalendarToken: null };
            Availability._mockQuery.select.mockResolvedValue(fakeDoc);

            const result = await repository.findAvailabilityWithToken("m_123");

            expect(decrypt).not.toHaveBeenCalled();
            expect(result.googleCalendarToken).toBeNull();
        });

        it("should return null gracefully if findOne returns no matching row", async () => {
            Availability._mockQuery.select.mockResolvedValue(null);

            const result = await repository.findAvailabilityWithToken("m_missing");
            expect(result).toBeNull();
        });
    });

    describe("saveCalendarToken", () => {
        it("should encrypt the token and execute findOneAndUpdate with upsert options enabled", async () => {
            const mockResult = { mentor: "m_123", googleCalendarConnected: true };
            Availability.findOneAndUpdate.mockResolvedValue(mockResult);

            const result = await repository.saveCalendarToken("m_123", "raw_token_data");

            expect(encrypt).toHaveBeenCalledWith("raw_token_data");
            expect(Availability.findOneAndUpdate).toHaveBeenCalledWith(
                { mentor: "m_123" },
                { googleCalendarConnected: true, googleCalendarToken: "encrypted_raw_token_data" },
                { upsert: true, new: true }
            );
            expect(result).toEqual(mockResult);
        });
    });

    describe("updateCalendarToken", () => {
        it("should swap outstanding encryption string fields without altering visibility markers", async () => {
            Availability.findOneAndUpdate.mockResolvedValue({ mentor: "m_123" });

            await repository.updateCalendarToken("m_123", "rotated_token_data");

            expect(encrypt).toHaveBeenCalledWith("rotated_token_data");
            expect(Availability.findOneAndUpdate).toHaveBeenCalledWith(
                { mentor: "m_123" },
                { googleCalendarToken: "encrypted_rotated_token_data" }
            );
        });
    });

    describe("disconnectCalendar", () => {
        it("should drop synchronization markers and clear out authentication keys strings", async () => {
            Availability.findOneAndUpdate.mockResolvedValue({ mentor: "m_123" });

            await repository.disconnectCalendar("m_123");

            expect(Availability.findOneAndUpdate).toHaveBeenCalledWith(
                { mentor: "m_123" },
                { googleCalendarConnected: false, googleCalendarToken: "" }
            );
        });
    });
});