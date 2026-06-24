// config/env.js
const required = (key) => {
    const value = process.env[key];
    if (!value) throw new Error(`Missing required env var: ${key}`);
    return value;
};
const optional = (key, def = undefined) => process.env[key] || def;

const config = {
    port: optional("PORT", "5000"),
    nodeEnv: optional("NODE_ENV", "development"),
    isProduction: process.env.NODE_ENV === "production",
    isTest: process.env.NODE_ENV === "test",

    mongoUri: required("MONGO_URI"),

    jwtSecret: required("JWT_SECRET"),
    jwtAccessExpiresIn: optional("JWT_ACCESS_EXPIRES_IN", "15m"),
    jwtRefreshExpiresInDays: Number.parseInt(optional("JWT_REFRESH_EXPIRES_IN_DAYS", "7"), 10),
    jwtAdminExpiresIn: optional("JWT_ADMIN_EXPIRES_IN", "7d"),

    googleClientId: required("GOOGLE_CLIENT_ID"),
    googleClientSecret: required("GOOGLE_CLIENT_SECRET"),
    googleRedirectUri: optional("GOOGLE_REDIRECT_URI"),

    clerkSecretKey: required("CLERK_SECRET_KEY"),

    appBaseUrl: required("APP_BASE_URL"),
    clientUrl: optional("CLIENT_URL"),
    corsOrigins: optional("CORS_ORIGINS", ""),

    smtpHost: optional("SMTP_HOST"),
    smtpPort: Number.parseInt(optional("SMTP_PORT", "587"), 10),
    smtpUser: optional("SMTP_USER"),
    smtpPass: optional("SMTP_PASS"),
    fromEmail: optional("FROM_EMAIL", "noreply@leapmentor.com"),

    cloudinaryCloudName: required("CLOUDINARY_CLOUD_NAME"),
    cloudinaryApiKey: required("CLOUDINARY_API_KEY"),
    cloudinaryApiSecret: required("CLOUDINARY_API_SECRET"),

    redisHost: optional("REDIS_HOST", "127.0.0.1"),
    redisPort: Number.parseInt(optional("REDIS_PORT", "6379"), 10),
    redisPassword: optional("REDIS_PASSWORD"),
    redisTls: optional("REDIS_TLS") === "true",
    redisUrl: optional("REDIS_URL"),

    vapidPublicKey: optional("VAPID_PUBLIC_KEY"),
    vapidPrivateKey: optional("VAPID_PRIVATE_KEY"),
    vapidEmail: optional("VAPID_EMAIL"),

    sentryDsn: optional("SENTRY_DSN"),
    logtailToken: optional("LOGTAIL_TOKEN"),
    groqApiKey: optional("GROQ_API_KEY"),
    calendarTokenEncKey: optional("CALENDAR_TOKEN_ENC_KEY"),
    platformTimezone: optional("PLATFORM_TIMEZONE", "Asia/Kolkata"),
    cookieDomain: optional("COOKIE_DOMAIN"),
};

module.exports = config;