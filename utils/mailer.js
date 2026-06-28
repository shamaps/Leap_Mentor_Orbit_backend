// utils/mailer.js
const nodemailer = require("nodemailer");
const { withRetry } = require("./withRetry");
const { getTraceId } = require("./requestContext");          
const config = require("../config/env");

const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
    },
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 10_000,
});

const sendMailWithRetry = (mailOptions) => {
    const optionsWithTrace = {
        ...mailOptions,
        headers: {
            ...mailOptions.headers,
            "X-Trace-Id": getTraceId(),                    
        },
    };
    return withRetry(() => transporter.sendMail(optionsWithTrace), { retries: 3, label: "sendMail" });
};

module.exports = transporter;
module.exports.sendMailWithRetry = sendMailWithRetry;