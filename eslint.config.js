import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize FlatCompat for compatibility with old "extends"
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  // Spread the compat.extends result, do NOT wrap it in an array
  ...compat.extends([
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "next/core-web-vitals",
  ]),
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: "./tsconfig.json",
      },
    },
    plugins: ["@typescript-eslint", "react", "react-hooks"],
    rules: {
      // Add your custom rules here
    },
    ignores: ["node_modules/", ".next/", "dist/"],
  },
];
