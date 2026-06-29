const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/googleCalendar.repository");
const Availability = require("../../../models/Availability"); // Swapped out faked schema model configurations

jest.mock("../../../utils/tokenCrypto", () => ({
    encrypt: jest.fn((text) => `enc_${text}`),
    decrypt: jest.fn((text) => text.replace("enc_", "")),
}));

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Google Calendar Repository (Integration)", () => {
    describe("saveCalendarToken", () => {
        it("should securely store encrypted parameter sequences into persistence slots", async () => {
            const mentorId = new mongoose.Types.ObjectId();
            const tokenPayload = '{"refresh_token":"abc"}';

            await repo.saveCalendarToken(mentorId, tokenPayload);

            const record = await Availability.findOne({ mentor: mentorId }).select("+googleCalendarToken").lean();
            expect(record.googleCalendarConnected).toBe(true);
            expect(record.googleCalendarToken).toBe(`enc_${tokenPayload}`);
        });
    });
});