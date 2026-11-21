import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
  recommendedConfig: js.configs.recommended,
});

export default [
  { ignores: ["node_modules/", ".next/", ".next-*/", "dist/", "build/", "out/"] },
  ...compat.config({
    extends: ["next/core-web-vitals", "eslint:recommended"],
    parser: "@typescript-eslint/parser",
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      ecmaFeatures: { jsx: true },
      project: "./tsconfig.json",
    },
    plugins: ["@typescript-eslint"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "react/react-in-jsx-scope": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/localhost:8000/]",
          message:
            "Do not hardcode the API origin. Use getPublicApiUrl() from '@/lib/api-base'. A localhost fallback points deployed builds at an origin that does not exist there, and it has been reintroduced in 15 files across this codebase.",
        },
      ],
    },
    overrides: [
      {
        files: ["**/*.ts", "**/*.tsx"],
        rules: { "no-undef": "off", "no-unused-vars": "off" },
      },
      {
        files: ["src/lib/api-base.ts"],
        rules: { "no-restricted-syntax": "off" },
      },
    ],
  }),
];
