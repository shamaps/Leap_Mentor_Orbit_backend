// eslint.config.js
const js = require("@eslint/js");
const nodePlugin = require("eslint-plugin-n");   
const globals = require("globals");
module.exports = [
    { ignores: ["coverage/**", "node_modules/**", "scripts/**"] },
    js.configs.recommended,
    // Main application code
    {
        files: ["**/*.js"],
        ignores: ["__tests__/**"],
        plugins: { node: nodePlugin },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: {
                ...globals.node,   
            },
        },
        rules: {
            "no-console": "error",
            "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "no-undef": "error",
            "node/no-missing-require": "error",
            "node/no-extraneous-require": "error",
            "prefer-const": "error",
            "no-var": "error",
            "eqeqeq": ["error", "always", { null: "ignore" }],
        },
    },
    // Test files
    {
        files: ["__tests__/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: {
                ...globals.node,
                ...globals.jest,   
            },
        },
        rules: {
            "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "no-undef": "error",
            "prefer-const": "error",
            "no-var": "error",
            "eqeqeq": ["error", "always", { null: "ignore" }],
        },
    },
];