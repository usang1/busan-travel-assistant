import js from "@eslint/js";
import { globalIgnores } from "eslint/config";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";

export default [
  globalIgnores([".next/**", "node_modules/**", "out/**", "build/**", "package-lock.json", "next-env.d.ts"]),
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-console": "error",
      "no-debugger": "error",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-console": "error",
      "no-debugger": "error",
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },
];
