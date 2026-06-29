module.exports = {
    testEnvironment: "node",
    testMatch: ["**/__tests__/**/*.test.js"],
    setupFiles: ["./jest.setup.env.js"],
    verbose: true,
    forceExit: true,
    clearMocks: true,
    bail: 1,
    testTimeout: 10000,
    coverageDirectory: "coverage",
    coverageReporters: ["lcov", "text", "clover"],
    collectCoverageFrom: [
        "controllers/**/*.js",
        "services/**/*.js",
        "repositories/**/*.js",
        "middleware/**/*.js",

        // Exclude infrastructure & generated/config files
        "!server.js",
        "!app.js",
        "!swagger.js",
        "!instrument.js",
        "!migrate-mongo-config.js",
        "!jest.config.js",
        "!jest.setup.env.js",
        "!eslint.config.js",

        // Exclude folders
        "!config/**",
        "!scripts/**",
        "!migrations/**",
        "!cron/**",
        "!socket/**",
        "!swagger/**",
        "!routes/**",
        "!validators/**",
        "!models/**",
        "!utils/**",

        "!**/node_modules/**",
        "!**/coverage/**",
    ]
};