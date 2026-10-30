const KEY_A = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
const KEY_B = "0".repeat(64);

const loadWithKey = (key) => {
    const previous = process.env.CALENDAR_TOKEN_ENC_KEY;
    if (key === undefined) delete process.env.CALENDAR_TOKEN_ENC_KEY;
    else process.env.CALENDAR_TOKEN_ENC_KEY = key;
    try {
        let mod;
        jest.isolateModules(() => { mod = require("../../utils/tokenCrypto"); });
        return mod;
    } finally {
        process.env.CALENDAR_TOKEN_ENC_KEY = previous;
    }
};

describe("tokenCrypto", () => {
    const { encrypt, decrypt } = require("../../utils/tokenCrypto");

    test("decrypt(encrypt(x)) returns x", () => {
        expect(decrypt(encrypt("ya29.a0AfH6SMB-refresh-token"))).toBe("ya29.a0AfH6SMB-refresh-token");
    });

    test.each([[""], ["x"], ["unicode ✓ 日本語 🔐"], ["a".repeat(10_000)]])("round-trips %#", (text) => {
        expect(decrypt(encrypt(text))).toBe(text);
    });

    test("ciphertext is base64 and does not contain the plaintext", () => {
        const out = encrypt("super-secret-token");
        expect(out).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
        expect(Buffer.from(out, "base64").toString("utf8")).not.toContain("super-secret-token");
    });

    test("uses a fresh random IV: the same input encrypts differently each time", () => {
        const a = encrypt("same");
        const b = encrypt("same");
        expect(a).not.toBe(b);
        expect(decrypt(a)).toBe("same");
        expect(decrypt(b)).toBe("same");
    });

    test("payload layout is 12-byte IV + 16-byte auth tag + ciphertext", () => {
        const plain = "twelve chars";
        const bytes = Buffer.from(encrypt(plain), "base64");
        expect(bytes.length).toBe(12 + 16 + Buffer.byteLength(plain));
    });

    test("a tampered ciphertext is rejected (GCM authentication)", () => {
        const bytes = Buffer.from(encrypt("do not touch"), "base64");
        bytes[bytes.length - 1] ^= 0xff;
        expect(() => decrypt(bytes.toString("base64"))).toThrow();
    });

    test("a tampered auth tag is rejected", () => {
        const bytes = Buffer.from(encrypt("do not touch"), "base64");
        bytes[12] ^= 0x01;
        expect(() => decrypt(bytes.toString("base64"))).toThrow();
    });

    test("garbage input is rejected", () => {
        expect(() => decrypt("not-a-real-payload")).toThrow();
    });

    test("data encrypted with one key cannot be decrypted with another", () => {
        const a = loadWithKey(KEY_A);
        const b = loadWithKey(KEY_B);
        expect(() => b.decrypt(a.encrypt("secret"))).toThrow();
    });

    describe("key validation at load time", () => {
        test.each([
            ["missing", undefined],
            ["too short", "abc123"],
            ["not hex", "z".repeat(64)],
            ["63 chars", "a".repeat(63)],
            ["65 chars", "a".repeat(65)],
        ])("throws when the key is %s", (_name, key) => {
            expect(() => loadWithKey(key)).toThrow(/CALENDAR_TOKEN_ENC_KEY must be set to a 64-character hex string/);
        });

        test("accepts an upper-case hex key", () => {
            expect(() => loadWithKey(KEY_A.toUpperCase())).not.toThrow();
        });
    });
});
