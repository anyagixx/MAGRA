// === MODULE_CONTRACT ===
// FILE: tests/magra-runtime-identity.test.ts
// VERSION: 1.0.0
// PURPOSE: Verify MAGRA is the primary runtime identity while Reasonix-compatible aliases keep routing.
// SCOPE: Identity helpers, chat/code prompts, package bins, CLI/UI labels, dashboard title, and desktop product labels.
// DEPENDS: M-MAGRA-RUNTIME-IDENTITY
// LINKS: docs/verification/V-M-MAGRA-RUNTIME-IDENTITY.xml
// ROLE: TEST
// MAP_MODE: LOCALS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: rootPath, readText, readJson
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial Phase-9 runtime identity regression coverage.
// === END_CHANGE_SUMMARY ===

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { codeSystemBase } from "../src/code/prompt.js";
import {
  MAGRA_CLI_NAME,
  MAGRA_CODE_NAME,
  MAGRA_COMPATIBILITY_ALIASES,
  MAGRA_PROJECT_NAME,
  defaultSystemPrompt,
  formatCompatibilityAlias,
  isCompatibilityAlias,
} from "../src/magra/identity.js";

const rootPath = dirname(dirname(fileURLToPath(import.meta.url)));

function readText(path: string): string {
  return readFileSync(join(rootPath, path), "utf8");
}

function readJson<T>(path: string): T {
  return JSON.parse(readText(path)) as T;
}

describe("MAGRA runtime identity", () => {
  it("builds the default chat prompt with MAGRA as primary identity and aliases as compatibility metadata", () => {
    // === START_BLOCK_ASSERT_CHAT_PROMPT_IDENTITY ===
    const prompt = defaultSystemPrompt("deepseek-v4-flash");
    expect(prompt).toContain(`You are ${MAGRA_PROJECT_NAME}`);
    expect(prompt).toContain("compatibility alias for magra");
    expect(prompt).toContain("reasonix is a compatibility alias");
    expect(prompt).toContain("dsnix is a compatibility alias");
    expect(prompt).not.toContain("You are Reasonix");
    expect(prompt).not.toContain("Reasonix VALIDATES");
    // === END_BLOCK_ASSERT_CHAT_PROMPT_IDENTITY ===
  });

  it("builds the code-mode prompt with MAGRA Code identity", () => {
    // === START_BLOCK_ASSERT_CODE_PROMPT_IDENTITY ===
    const prompt = codeSystemBase("deepseek-v4-flash");
    expect(prompt).toContain(`You are ${MAGRA_CODE_NAME}`);
    expect(prompt).toContain(`${MAGRA_PROJECT_NAME} VALIDATES`);
    expect(prompt).toContain(`${MAGRA_CLI_NAME} code`);
    expect(prompt).not.toContain("You are Reasonix Code");
    expect(prompt).not.toContain("Reasonix VALIDATES");
    // === END_BLOCK_ASSERT_CODE_PROMPT_IDENTITY ===
  });

  it("keeps reasonix and dsnix as explicit package aliases for the MAGRA CLI", () => {
    // === START_BLOCK_ASSERT_PACKAGE_ALIASES ===
    const pkg = readJson<{ name: string; bin: Record<string, string> }>("package.json");
    expect(pkg.name).toBe(MAGRA_CLI_NAME);
    expect(pkg.bin[MAGRA_CLI_NAME]).toBe("dist/cli/index.js");
    for (const alias of MAGRA_COMPATIBILITY_ALIASES) {
      expect(pkg.bin[alias]).toBe("dist/cli/index.js");
      expect(isCompatibilityAlias(alias)).toBe(true);
      expect(formatCompatibilityAlias(alias)).toContain(`routes to ${MAGRA_PROJECT_NAME}`);
    }
    expect(() => formatCompatibilityAlias("unknown")).toThrow(/Unsupported MAGRA/);
    // === END_BLOCK_ASSERT_PACKAGE_ALIASES ===
  });

  it("uses MAGRA on primary CLI and dashboard runtime labels", () => {
    // === START_BLOCK_ASSERT_RUNTIME_LABELS ===
    const cliIndex = readText("src/cli/index.ts");
    const statsPanel = readText("src/cli/ui/StatsPanel.tsx");
    const dashboardHtml = readText("dashboard/index.html");
    const dashboardApp = readText("dashboard/src/App.tsx");
    const dashboardThread = readText("dashboard/src/ui/thread.tsx");
    const desktopHtml = readText("desktop/index.html");
    const desktopConfig = readJson<{
      productName: string;
      app: { windows: Array<{ title: string }> };
    }>("desktop/src-tauri/tauri.conf.json");

    expect(cliIndex).toContain(".name(MAGRA_CLI_NAME)");
    expect(statsPanel).toContain("{MAGRA_PROJECT_NAME}");
    expect(dashboardHtml).toContain("<title>MAGRA</title>");
    expect(dashboardApp).toContain('className="brand-name">MAGRA</span>');
    expect(dashboardThread).toContain('className="name">MAGRA</span>');
    expect(desktopHtml).toContain("<title>MAGRA</title>");
    expect(desktopConfig.productName).toBe(MAGRA_PROJECT_NAME);
    expect(desktopConfig.app.windows[0]?.title).toBe(MAGRA_PROJECT_NAME);
    // === END_BLOCK_ASSERT_RUNTIME_LABELS ===
  });
});
