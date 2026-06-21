// utils/tokenCrypto.js
const crypto = require("node:crypto");

const ALGORITHM = "aes-256-gcm";
const rawKey = process.env.CALENDAR_TOKEN_ENC_KEY;

if (!rawKey || !/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    throw new Error(
        "CALENDAR_TOKEN_ENC_KEY must be set to a 64-character hex string (32 bytes). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
}

const KEY = Buffer.from(rawKey, "hex");

const encrypt = (plainText) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // store iv + authTag + ciphertext together, all base64
    return Buffer.concat([iv, authTag, encrypted]).toString("base64");
};

const decrypt = (payload) => {
    const data = Buffer.from(payload, "base64");
    const iv = data.subarray(0, 12);
    const authTag = data.subarray(12, 28);
    const encrypted = data.subarray(28);
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
};

module.exports = { encrypt, decrypt };