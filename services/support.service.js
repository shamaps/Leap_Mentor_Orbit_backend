const { sendSupportResolvedEmail } = require("../utils/emails");
const repo = require("../repositories/support.repository");

const logger = require("../utils/logger");
const createMessage = async ({ email, subject, message, role }) => {
    if (!email || !subject || !message) {
        return { status: 400, body: { error: "All fields are required" } };
    }

    const msg = await repo.createSupportMessage({
        email,
        subject,
        message,
        role: role || "user",
        status: "open",
    });

    return { status: 201, body: msg };
};

const getMessages = async () => {
    const msgs = await repo.findAllMessages();
    return { status: 200, body: msgs };
};

const resolveMessage = async (id) => {
    const msg = await repo.resolveMessageById(id);
    if (!msg) return { status: 404, body: { error: "Not found" } };

    // ── Find user by email to send notification ──────────────
    const user = await repo.findUserByEmail(msg.email);

    // ── 1. Dashboard notification (if user account found) ────
    if (user) {
        await repo.createNotification({
            recipient: user._id,
            type: "support_resolved",
            title: "Support ticket resolved ✅",
            message: `Your support request "${msg.subject}" has been resolved by our team.`,
            read: false,
            metadata: {},
        });
    }

    // ── 2. Email notification (non-blocking) ─────────────────
    sendSupportResolvedEmail({ toEmail: msg.email, subject: msg.subject })
        .catch((emailErr) => logger.error("⚠️ Support resolved email failed:", emailErr.message));

    return { status: 200, body: msg };
};

module.exports = {
    createMessage,
    getMessages,
    resolveMessage,
};