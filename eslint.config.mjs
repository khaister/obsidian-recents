import { globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  globalIgnores(["node_modules", "demo-vault", "main.js", "*.mjs", "tests", "vitest.config.ts"]),
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: { allowDefaultProject: ["manifest.json"] },
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".json"],
      },
    },
  },
  ...obsidianmd.configs.recommended,
);
