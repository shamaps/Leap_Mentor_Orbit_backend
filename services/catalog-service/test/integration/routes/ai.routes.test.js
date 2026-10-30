/**
 * @fileoverview Integration tests for the Groq-backed help-center chat proxy.
 * The global fetch is mocked, so no network call is ever made.
 */

const request = require("supertest");
const express = require("express");

const mockAuthenticate = jest.fn((req, res, next) => { req.user = { _id: "user_1" }; next(); });
const mockAiLimiter = jest.fn((req, res, next) => next());

jest.mock("@leapmentor/shared/middleware/authenticate", () => ({
    authenticate: (req, res, next) => mockAuthenticate(req, res, next),
}));
jest.mock("@leapmentor/shared/middleware/rateLimiter", () => ({
    aiLimiter: (req, res, next) => mockAiLimiter(req, res, next),
}));
jest.mock("@leapmentor/shared/utils/logger", () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const aiRoutes = require("../../../src/routes/ai.routes");

const app = express();
app.use(express.json());
app.use("/ai", aiRoutes);

const messages = [{ role: "user", content: "How do I book a session?" }];
const groqOk = (text) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: text } }] }) });

let originalFetch;
let previousKey;
let previousModel;

beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue(groqOk("Open a mentor profile and pick a slot."));
    previousKey = process.env.GROQ_API_KEY;
    previousModel = process.env.GROQ_MODEL;
    process.env.GROQ_API_KEY = "test-groq-key";
    delete process.env.GROQ_MODEL;
    mockAuthenticate.mockClear();
    mockAiLimiter.mockClear();
});

afterEach(() => {
    global.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.GROQ_MODEL;
    else process.env.GROQ_MODEL = previousModel;
});

describe("AI chat route (Integration)", () => {
    describe("middleware", () => {
        it("should run authentication and the AI rate limiter before the handler", async () => {
            await request(app).post("/ai/chat").send({ messages });

            expect(mockAuthenticate).toHaveBeenCalledTimes(1);
            expect(mockAiLimiter).toHaveBeenCalledTimes(1);
        });

        it("should stop at authentication and never call Groq when the caller is not logged in", async () => {
            mockAuthenticate.mockImplementationOnce((req, res) => res.status(401).json({ success: false }));

            const res = await request(app).post("/ai/chat").send({ messages });

            expect(res.status).toBe(401);
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it("should stop at the rate limiter and never call Groq when the limit is hit", async () => {
            mockAiLimiter.mockImplementationOnce((req, res) => res.status(429).json({ success: false }));

            const res = await request(app).post("/ai/chat").send({ messages });

            expect(res.status).toBe(429);
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });

    describe("validation", () => {
        it("should reject a missing messages field with 400", async () => {
            const res = await request(app).post("/ai/chat").send({});

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ error: "messages array is required" });
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it.each([["a string", "hello"], ["an object", { role: "user" }], ["a number", 5]])(
            "should reject messages sent as %s with 400",
            async (_label, value) => {
                const res = await request(app).post("/ai/chat").send({ messages: value });

                expect(res.status).toBe(400);
                expect(global.fetch).not.toHaveBeenCalled();
            }
        );

        it("should accept an empty messages array", async () => {
            const res = await request(app).post("/ai/chat").send({ messages: [] });

            expect(res.status).toBe(200);
        });
    });

    describe("successful proxying", () => {
        it("should reshape the Groq reply into the content/text format the help center expects", async () => {
            const res = await request(app).post("/ai/chat").send({ messages, systemPrompt: "You are helpful." });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ content: [{ type: "text", text: "Open a mentor profile and pick a slot." }] });
        });

        it("should call the Groq chat completions endpoint with the API key", async () => {
            await request(app).post("/ai/chat").send({ messages });

            const [url, options] = global.fetch.mock.calls[0];
            expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
            expect(options.method).toBe("POST");
            expect(options.headers.Authorization).toBe("Bearer test-groq-key");
            expect(options.headers["Content-Type"]).toBe("application/json");
        });

        it("should put the system prompt first and then the caller's messages", async () => {
            await request(app).post("/ai/chat").send({ messages, systemPrompt: "Be brief." });

            const body = JSON.parse(global.fetch.mock.calls[0][1].body);
            expect(body.messages).toEqual([{ role: "system", content: "Be brief." }, ...messages]);
            expect(body.max_tokens).toBe(1000);
        });

        it("should use the default model when GROQ_MODEL is not set", async () => {
            await request(app).post("/ai/chat").send({ messages });

            expect(JSON.parse(global.fetch.mock.calls[0][1].body).model).toBe("openai/gpt-oss-20b");
        });

        it("should use GROQ_MODEL when it is set", async () => {
            process.env.GROQ_MODEL = "llama-3.1-8b-instant";

            await request(app).post("/ai/chat").send({ messages });

            expect(JSON.parse(global.fetch.mock.calls[0][1].body).model).toBe("llama-3.1-8b-instant");
        });

        it("should return an empty text when Groq sends no choices", async () => {
            global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

            const res = await request(app).post("/ai/chat").send({ messages });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ content: [{ type: "text", text: "" }] });
        });
    });

    describe("timeout", () => {
        it("should pass an abort signal to fetch and arm a 10 second timer that aborts it", async () => {
            const timerSpy = jest.spyOn(global, "setTimeout");

            await request(app).post("/ai/chat").send({ messages });

            const { signal } = global.fetch.mock.calls[0][1];
            expect(signal).toBeInstanceOf(AbortSignal);
            expect(signal.aborted).toBe(false);

            const timeoutCall = timerSpy.mock.calls.find(([, delay]) => delay === 10_000);
            expect(timeoutCall).toBeDefined();
            timeoutCall[0]();
            expect(signal.aborted).toBe(true);
        });

        it("should answer 504 when Groq does not respond in time", async () => {
            global.fetch.mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));

            const res = await request(app).post("/ai/chat").send({ messages });

            expect(res.status).toBe(504);
            expect(res.body).toEqual({ success: false, message: "AI service timed out" });
        });
    });

    describe("failures", () => {
        it("should answer 502 and never forward the vendor error body when Groq returns an error", async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                status: 429,
                json: async () => ({ error: { code: "rate_limit", message: "secret vendor detail" } }),
            });

            const res = await request(app).post("/ai/chat").send({ messages });

            expect(res.status).toBe(502);
            expect(res.body).toEqual({ success: false, message: "AI service temporarily unavailable" });
            expect(JSON.stringify(res.body)).not.toContain("secret vendor detail");
        });

        it("should answer 502 even when the error body has no error details", async () => {
            global.fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

            const res = await request(app).post("/ai/chat").send({ messages });

            expect(res.status).toBe(502);
        });

        it("should answer 500 on a network failure that is not a timeout", async () => {
            global.fetch.mockRejectedValue(new Error("ECONNRESET"));

            const res = await request(app).post("/ai/chat").send({ messages });

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ success: false, message: "AI service unavailable" });
        });

        it("should answer 500 when Groq returns a body that is not valid JSON", async () => {
            global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad json"); } });

            const res = await request(app).post("/ai/chat").send({ messages });

            expect(res.status).toBe(500);
        });
    });
});
