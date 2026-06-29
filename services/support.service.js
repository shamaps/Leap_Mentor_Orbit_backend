// services/support.service.js
const { sendSupportResolvedEmail } = require("../utils/emails");
const { toSupportMessageDTO, toSupportListDTO } = require("../utils/mappers/support.mapper");

/**
 * @typedef {Object} SupportRepository
 * @property {(data: Object) => Promise<Object>} createSupportMessage - Persists a fresh inbound support request entry.
 * @property {(skip: number, limit: number) => Promise<Object[]>} findAllMessages - Fetches a chronologically sorted list of all support tickets.
 * @property {() => Promise<number>} countMessages - Quantifies total historical support logs.
 * @property {(id: string) => Promise<Object|null>} resolveMessageById - Finds and updates a support message state to resolved.
 * @property {(email: string) => Promise<Object|null>} findUserByEmail - Queries user data records matching a customer email.
 * @property {(data: Object) => Promise<Object>} createNotification - Provisions an in-app system notification row.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string) => void} info - Logs routine operation milestones.
 * @property {(message: string, meta?: Object) => void} warn - Logs background mailing or process failures.
 */

/**
 * Factory function constructing the core system Support Ticket Service layer.
 * * @param {SupportRepository} repo - Abstraction data registry layer instance.
 * @param {{ logger: Logger }} dependencies - Application core telemetry tracing tools.
 * @returns {Object} Configured service interface container exposing ticket handling methodologies.
 */
const createSupportService = (repo, { logger }) => {

    /**
     * Syntactically evaluates inbound fields and logs a new support ticket message.
     * * @async
     * @function createMessage
     * @param {Object} payload - Combined ticket processing criteria container data.
     * @param {string} payload.email - Customer communication contact email address.
     * @param {string} payload.subject - Text sequence describing request intentions.
     * @param {string} payload.message - Comprehensive body details text explaining the concern.
     * @param {string} [payload.role="user"] - Access scope status identifier label ("mentor", "mentee", "user").
     * @returns {Promise<{ status: number, body: Object }>} Internal status block descriptor containing the generated message DTO.
     */
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

        return { status: 201, body: toSupportMessageDTO(msg) };
    };

    /**
     * Pulls a paginated ledger listing containing all historical platform support requests.
     * * @async
     * @function getMessages
     * @param {Object} [options={}] - Pagination bounds envelope.
     * @param {number|string} [options.page=1] - Dynamic target page multiplier selector parameter.
     * @param {number|string} [options.limit=50] - Sizing definition configuration parameter managing list row thickness.
     * @returns {Promise<{ status: number, body: Object }>} Placed list payload containing formatted messages list and tracking data.
     */
    const getMessages = async ({ page = 1, limit = 50 } = {}) => {
        const safePage = Math.max(1, Number.parseInt(page) || 1);
        const safeLimit = Math.min(100, Number.parseInt(limit) || 50);
        const skip = (safePage - 1) * safeLimit;

        const [msgs, total] = await Promise.all([
            repo.findAllMessages(skip, safeLimit),
            repo.countMessages(),
        ]);

        const pagination = { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) };

        return {
            status: 200,
            body: toSupportListDTO({ messages: msgs, pagination }),
        };
    };

    /**
     * Marks an open support ticket resolved, triggering dashboard notifications and non-blocking validation emails.
     * * @async
     * @function resolveMessage
     * @param {string} id - Target primary database entry unique lookup index key.
     * @returns {Promise<{ status: number, body: Object }>} Modified report message DTO or failure envelope.
     */
    const resolveMessage = async (id) => {
        const msg = await repo.resolveMessageById(id);
        if (!msg) return { status: 404, body: { success: false, message: "Not found" } };

        const user = await repo.findUserByEmail(msg.email);

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

        sendSupportResolvedEmail({ toEmail: msg.email, subject: msg.subject })
            .catch((emailErr) => logger.warn("Support resolved email failed", { error: emailErr.message }));

        return { status: 200, body: toSupportMessageDTO(msg) };
    };

    return { createMessage, getMessages, resolveMessage };
};

module.exports = createSupportService;