module.exports = {
  root: false,
  env: {
    es2022: true,
  },
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["plugin:@typescript-eslint/recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  ignorePatterns: [
    "dist/",
    "build/",
    ".next/",
    ".astro/",
    ".turbo/",
    "coverage/",
  ],
};
