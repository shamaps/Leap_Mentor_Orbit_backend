// eslint.config.js
const js = require("@eslint/js");
const nodePlugin = require("eslint-plugin-node");

module.exports = [
    js.configs.recommended,
    {
        plugins: { node: nodePlugin },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: {
                process: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                require: "readonly",
                module: "writable",
                exports: "writable",
                Buffer: "readonly",
                console: "readonly",
            },
        },
        rules: {
            "no-console": "error",          // enforce logger usage, no console.log
            "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "no-undef": "error",
            "node/no-missing-require": "error",
            "node/no-extraneous-require": "error",
            "prefer-const": "error",
            "no-var": "error",
            "eqeqeq": ["error", "always"],
        },
        ignores: ["coverage/**", "node_modules/**", "scripts/**"],
    },
];