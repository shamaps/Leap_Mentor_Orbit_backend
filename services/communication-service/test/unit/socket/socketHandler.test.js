jest.mock("@leapmentor/shared/models/Message", () => ({ updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }) }));
jest.mock("@leapmentor/shared/models/ConnectRequest", () => ({ findById: jest.fn() }));
jest.mock("@sentry/node", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const ConnectRequest = require("@leapmentor/shared/models/ConnectRequest");
const socketHandler = require("../../../src/socket/socketHandler");

describe("socket participant ID normalization", () => {
    it("authorizes populated participants and routes emits for ObjectId shaped users", async () => {
        const request = {
            status: "ongoing",
            mentor: { _id: "mentor-1", name: "Mentor" },
            mentee: { toHexString: () => "mentee-1" },
        };
        const query = {
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(request),
        };
        ConnectRequest.findById.mockReturnValue(query);

        let onConnection;
        const socketEvents = new Map();
        const delivered = jest.fn();
        const io = {
            on: jest.fn((event, callback) => { if (event === "connection") onConnection = callback; }),
            to: jest.fn(() => ({ emit: delivered })),
        };
        const socket = {
            id: "socket-1",
            user: { _id: { toHexString: () => "mentor-1" }, email: "mentor@example.com" },
            on: jest.fn((event, callback) => socketEvents.set(event, callback)),
            emit: jest.fn(),
            join: jest.fn(),
            to: jest.fn(() => ({ emit: jest.fn() })),
        };

        socketHandler(io);
        onConnection(socket);
        await socketEvents.get("join_room")({ connectRequestId: "request-1" });

        expect(socket.join).toHaveBeenCalledWith("request-1");
        expect(socket.emit).not.toHaveBeenCalledWith("error", expect.anything());
        expect(socketHandler.emitToUser({ toHexString: () => "mentor-1" }, "notice", { ok: true })).toBe(true);
        expect(io.to).toHaveBeenCalledWith("socket-1");
        expect(delivered).toHaveBeenCalledWith("notice", { ok: true });
    });
});
