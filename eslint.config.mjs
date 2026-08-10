import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";

export default [
  eslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 2022,
        sourceType: "module",
      },
      globals: {
        Node: "readonly",
        console: "readonly",
        process: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs["recommended-type-checked"].rules,
      ...tseslint.configs["recommended-requiring-type-checking"].rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-misused-promises": "off",
    },
  },
  {
    files: ["tests/**/*.ts", "src/**/*.ts"],
    languageOptions: {
      globals: {
        vitest: "readonly",
      },
    },
  },
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "tests/**/*.d.ts",
      "tests/**/*.js",
      "vitest.config.d.ts",
      "vitest.config.js",
    ],
  },
  prettier,
];
