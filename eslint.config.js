
const js = require("@eslint/js");
const nodePlugin = require("eslint-plugin-n");
const globals = require("globals");

const testPatterns = [
    "**/test/**",
    "**/__tests__/**",
    "**/*.test.js",
    "**/*.spec.js",
];

module.exports = [
    {
        ignores: [
            "**/node_modules/**",
            "**/coverage/**",
            "**/scripts/**",
            "**/.scannerwork/**",
        ],
    },

    js.configs.recommended,

    // Application code
    {
        files: ["**/*.js"],
        ignores: testPatterns,
        plugins: {
            node: nodePlugin,
        },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: {
                ...globals.node,
            },
        },
        rules: {
            "no-console": "error",
            "no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_" },
            ],
            "no-undef": "error",
            "node/no-missing-require": "error",
            // Disabled because workspace dependencies can be
            // declared in individual service package.json files.
            "node/no-extraneous-require": "off",
            "prefer-const": "error",
            "no-var": "error",
            eqeqeq: ["error", "always", { null: "ignore" }],
        },
    },

    // Test files
    {
        files: testPatterns,
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: {
                ...globals.node,
                ...globals.jest,
                ...globals.mocha,
            },
        },
        rules: {
            "no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_" },
            ],
            "no-undef": "error",
            "prefer-const": "error",
            "no-var": "error",
            eqeqeq: ["error", "always", { null: "ignore" }],
        },
    },

    // Tooling outside production application code
    {
        files: ["tools/**/*.js"],
        rules: {
            "no-console": "off",
        },
    },
];
