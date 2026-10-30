
/**
 * @fileoverview Global test environment variables for Jest.
 * These are test-only values, not production credentials.
 */

process.env.NODE_ENV = "test";

process.env.MONGO_URI =
    "mongodb://localhost:27017/dummy_test_db";

process.env.JWT_SECRET =
    "test_fallback_secret_key_32_characters_minimum";

process.env.JWT_ADMIN_EXPIRES_IN = "1d";

process.env.GOOGLE_CLIENT_ID =
    "dummy_google_client_id";

process.env.GOOGLE_CLIENT_SECRET =
    "dummy_google_client_secret";

process.env.GOOGLE_REDIRECT_URI =
    "http://localhost:3000/auth/google/callback";

process.env.CLOUDINARY_CLOUD_NAME = "dummy_cloud";
process.env.CLOUDINARY_API_KEY = "dummy_key";
process.env.CLOUDINARY_API_SECRET = "dummy_secret";

process.env.FROM_EMAIL = "test@leapmentor.com";
process.env.APP_BASE_URL = "http://localhost:3000";

process.env.REDIS_URL = "redis://localhost:6379";

process.env.CLERK_SECRET_KEY =
    "dummy_clerk_secret_key";

process.env.CALENDAR_TOKEN_ENC_KEY =
    "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
