module.exports = {
    rootDir: ".",
    testEnvironment: "node",

    testMatch: [
        "<rootDir>/services/**/test/**/*.test.js",
        "<rootDir>/shared/**/test/**/*.test.js",
        "<rootDir>/services/**/__tests__/**/*.test.js",
        "<rootDir>/shared/**/__tests__/**/*.test.js"
    ],
    testPathIgnorePatterns: ["/node_modules/"],
    setupFiles: [
        "<rootDir>/jest.setup.env.js"
    ],

    verbose: true,
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 10000,

    coverageDirectory: "<rootDir>/coverage",
    coverageReporters: ["lcov", "text", "clover"],

    collectCoverageFrom: [
        "services/*/src/**/*.js",
        "shared/**/*.js",
        "!**/node_modules/**",
        "!**/coverage/**",
        "!**/test/**",
        "!**/__tests__/**",
        "!**/*.test.js",
        "!**/*.spec.js",
        "!**/server.js",
        "!**/instrument.js"
    ]
};