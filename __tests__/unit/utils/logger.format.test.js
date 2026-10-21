jest.mock("winston", () => {
    const createLogger = jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
    const printf = jest.fn((formatter) => ({ formatter }));
    return {
        createLogger,
        format: {
            combine: (...formats) => formats,
            colorize: () => ({ type: "colorize" }),
            timestamp: () => ({ type: "timestamp" }),
            json: () => ({ type: "json" }),
            printf,
        },
        transports: { Console: jest.fn((options) => options) },
    };
});
jest.mock("@logtail/node", () => ({ Logtail: jest.fn() }));
jest.mock("@logtail/winston", () => ({ LogtailTransport: jest.fn() }));
jest.mock("@sentry/node", () => ({ logger: { warn: jest.fn(), error: jest.fn() } }));

const { transports } = require("winston");
require("../../../utils/logger");

const formatter = transports.Console.mock.calls[0][0].format.at(-1).formatter;

describe("development logger formatter", () => {
    it("preserves string timestamps and messages", () => {
        expect(formatter({ timestamp: "12:30:00", level: "info", message: "ready" }))
            .toBe("12:30:00 [info] ready");
    });

    it("serializes object timestamps and messages explicitly", () => {
        expect(formatter({ timestamp: { at: "noon" }, level: "info", message: { state: "ready" } }))
            .toBe('{"at":"noon"} [info] {"state":"ready"}');
    });
});
