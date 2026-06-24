// utils/mailer.js
const nodemailer = require("nodemailer");
const { withRetry } = require("./withRetry");
const { getTraceId } = require("./requestContext");          

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 10_000,
});

const sendMailWithRetry = (mailOptions) => {
    const optionsWithTrace = {
        ...mailOptions,
        headers: {
            ...(mailOptions.headers || {}),
            "X-Trace-Id": getTraceId(),                    
        },
    };
    return withRetry(() => transporter.sendMail(optionsWithTrace), { retries: 3, label: "sendMail" });
};

module.exports = transporter;
module.exports.sendMailWithRetry = sendMailWithRetry;