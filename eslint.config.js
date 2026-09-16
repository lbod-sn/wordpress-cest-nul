import js from "@eslint/js";
import globals from "globals";

export default [
  {
    // index.html est un bundle genere : son JS inline n'est pas source de verite.
    ignores: ["node_modules/**", "coverage/**", "*.old", "index.html"],
  },
  js.configs.recommended,
  {
    files: ["app.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "script",
      globals: globals.browser,
    },
  },
  {
    files: ["tests/**/*.js", "scripts/**/*.mjs", "*.config.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
