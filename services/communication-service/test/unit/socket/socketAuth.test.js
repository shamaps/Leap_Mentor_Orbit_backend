/**
 * @fileoverview Unit tests for the Socket.IO handshake authentication middleware.
 */

jest.mock("@leapmentor/shared/models/User", () => ({ findById: jest.fn() }));

const jwt = require("jsonwebtoken");
const User = require("@leapmentor/shared/models/User");
const socketAuth = require("../../../src/socket/socketAuth");

const SECRET = process.env.JWT_SECRET;
const USER_ID = "a".repeat(24);

const makeSocket = (auth) => ({ handshake: { auth } });
const signToken = (payload = { id: USER_ID }, secret = SECRET, options) => jwt.sign(payload, secret, options);

// Makes User.findById(...).select(...) resolve to `user` and returns the query for assertions.
const givenUser = (user) => {
    const query = { select: jest.fn().mockResolvedValue(user) };
    User.findById.mockReturnValue(query);
    return query;
};

describe("socketAuth middleware", () => {
    describe("missing token", () => {
        it.each([
            ["no auth object", undefined],
            ["an empty auth object", {}],
            ["an empty token", { token: "" }],
        ])("should reject a handshake with %s", async (_label, auth) => {
            const next = jest.fn();

            await socketAuth(makeSocket(auth), next);

            expect(next).toHaveBeenCalledTimes(1);
            expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
            expect(next.mock.calls[0][0].message).toBe("Authentication error: no token provided");
            expect(User.findById).not.toHaveBeenCalled();
        });
    });

    describe("valid token", () => {
        it("should attach the user to the socket and continue without an error", async () => {
            const user = { _id: USER_ID, name: "Asha" };
            const query = givenUser(user);
            const socket = makeSocket({ token: signToken() });
            const next = jest.fn();

            await socketAuth(socket, next);

            expect(socket.user).toBe(user);
            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith();
            expect(User.findById).toHaveBeenCalledWith(USER_ID);
            expect(query.select).toHaveBeenCalledWith("-password");
        });

        it("should reject when the user in the token no longer exists", async () => {
            givenUser(null);
            const socket = makeSocket({ token: signToken() });
            const next = jest.fn();

            await socketAuth(socket, next);

            expect(next).toHaveBeenCalledTimes(1);
            expect(next.mock.calls[0][0].message).toBe("Authentication error: user not found");
            expect(socket.user).toBeUndefined();
        });
    });

    describe("bad tokens", () => {
        const expectInvalid = async (token) => {
            const socket = makeSocket({ token });
            const next = jest.fn();

            await socketAuth(socket, next);

            expect(next).toHaveBeenCalledTimes(1);
            expect(next.mock.calls[0][0].message).toBe("Authentication error: invalid or expired token");
            expect(socket.user).toBeUndefined();
            expect(User.findById).not.toHaveBeenCalled();
        };

        it("should reject a token signed with a different secret", async () => {
            await expectInvalid(signToken({ id: USER_ID }, "some-other-secret"));
        });

        it("should reject an expired token", async () => {
            const expired = signToken({ id: USER_ID, exp: Math.floor(Date.now() / 1000) - 60 });

            await expectInvalid(expired);
        });

        it("should reject a malformed token", async () => {
            await expectInvalid("not-a-jwt");
        });

        it("should reject an unsigned (alg: none) token", async () => {
            const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
            const unsigned = `${b64({ alg: "none", typ: "JWT" })}.${b64({ id: USER_ID })}.`;

            await expectInvalid(unsigned);
        });
    });

    describe("unexpected failures", () => {
        it("should fail closed and reject every token when no JWT secret is configured", async () => {
            const token = signToken();
            delete process.env.JWT_SECRET;
            const socket = makeSocket({ token });
            const next = jest.fn();

            try {
                await socketAuth(socket, next);
            } finally {
                process.env.JWT_SECRET = SECRET;
            }

            // jsonwebtoken reports a missing secret as a JsonWebTokenError, so it is treated like a bad token.
            expect(next).toHaveBeenCalledTimes(1);
            expect(next.mock.calls[0][0].message).toBe("Authentication error: invalid or expired token");
            expect(socket.user).toBeUndefined();
            expect(User.findById).not.toHaveBeenCalled();
        });

        it("should pass a database error through to next unchanged", async () => {
            const dbError = new Error("mongo down");
            User.findById.mockReturnValue({ select: jest.fn().mockRejectedValue(dbError) });
            const next = jest.fn();

            await socketAuth(makeSocket({ token: signToken() }), next);

            expect(next).toHaveBeenCalledTimes(1);
            expect(next.mock.calls[0][0]).toBe(dbError);
        });
    });
});