const { sendSupportResolvedEmail } = require("../utils/emails");
const createSupportService = (repo, { logger }) => {
    const createMessage = async ({ email, subject, message, role }) => {
        if (!email || !subject || !message) {
            return { status: 400, body: { success: false, message: "All fields are required" } };
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

    const getMessages = async ({ page = 1, limit = 50 } = {}) => {
        const safePage = Math.max(1, Number.parseInt(page) || 1);
        const safeLimit = Math.min(100, Number.parseInt(limit) || 50);
        const skip = (safePage - 1) * safeLimit;

        const [msgs, total] = await Promise.all([
            repo.findAllMessages(skip, safeLimit),
            repo.countMessages(),
        ]);

        return {
            status: 200,
            body: {
                messages: msgs,
                pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) },
            },
        };
    };

    const resolveMessage = async (id) => {
        const msg = await repo.resolveMessageById(id);
        if (!msg) return { status: 404, body: { success: false, message: "Not found" } };

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
            .catch((emailErr) => logger.warn("Support resolved email failed", { error: emailErr.message }));

        return { status: 200, body: msg };
    };

    return { createMessage, getMessages, resolveMessage };
};
module.exports = createSupportService;