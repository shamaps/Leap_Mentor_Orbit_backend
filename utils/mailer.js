// utils/mailer.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 5_000,   // 5s to establish TCP connection to SMTP server
    greetingTimeout: 5_000,   // 5s to receive SMTP greeting after connecting
    socketTimeout: 10_000,  // 10s of inactivity before the socket is killed
});

module.exports = transporter;