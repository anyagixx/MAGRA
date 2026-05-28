// === MODULE_CONTRACT ===
// FILE: tests/rtk-shell-policy.test.ts
// VERSION: 1.0.0
// PURPOSE: Verify MAGRA RTK shell policy classification, health, savings, and shell gate integration.
// SCOPE: RTK command rewrite decisions, raw bypass, missing RTK fallback, savings parsing, and approval payloads.
// DEPENDS: M-RTK-SHELL-POLICY
// LINKS: docs/verification/V-M-RTK-SHELL-POLICY.xml
// ROLE: TEST
// MAP_MODE: LOCALS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: RTK shell policy unit assertions
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial verification for MAGRA RTK shell policy.
// === END_CHANGE_SUMMARY ===

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type ConfirmationChoice, PauseGate } from "../src/core/pause-gate.js";
import { ToolRegistry } from "../src/tools.js";
import {
  type RtkCommandRunner,
  buildRtkCommand,
  diagnoseRtk,
  readRtkSavings,
  resolveRtkPolicy,
} from "../src/tools/rtk-shell-policy.js";
import { registerShellTools } from "../src/tools/shell.js";

class SpyGate extends PauseGate {
  lastCall: Parameters<PauseGate["ask"]>[0] | null = null;
  override ask = ((opts: Parameters<PauseGate["ask"]>[0]) => {
    this.lastCall = opts;
    return Promise.resolve({
      type: "deny",
      denyContext: "verify effective command",
    } as ConfirmationChoice);
  }) as PauseGate["ask"];
}

describe("RTK shell policy", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "magra-rtk-policy-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("rewrites eligible commands through RTK", () => {
    // === START_BLOCK_ASSERT_REWRITE ===
    const decision = resolveRtkPolicy("npm test -- --runInBand", { rtkAvailable: true });
    const command = buildRtkCommand(decision);

    expect(decision.mode).toBe("rtk");
    expect(decision.eligible).toBe(true);
    expect(command.command).toBe("rtk npm test -- --runInBand");
    expect(command.viaRtk).toBe(true);
    expect(command.reason).toContain("[RtkShellPolicy][buildRtkCommand][BLOCK_REWRITE_COMMAND]");
    // === END_BLOCK_ASSERT_REWRITE ===
  });

  it("keeps explicit raw bypass and unavailable RTK on the original command", () => {
    // === START_BLOCK_ASSERT_RAW_BYPASS ===
    const raw = buildRtkCommand(resolveRtkPolicy("rtk proxy npm test", { rtkAvailable: true }));
    expect(raw.command).toBe("rtk proxy npm test");
    expect(raw.viaRtk).toBe(false);

    const missing = resolveRtkPolicy("npm test", { rtkAvailable: false });
    expect(missing.mode).toBe("raw");
    expect(missing.reason).toBe("rtk-unavailable");
    expect(buildRtkCommand(missing).command).toBe("npm test");
    // === END_BLOCK_ASSERT_RAW_BYPASS ===
  });

  it("does not rewrite compound shell commands or package installs", () => {
    // === START_BLOCK_ASSERT_CLASSIFICATION_GUARDS ===
    expect(resolveRtkPolicy("npm test && npm run lint", { rtkAvailable: true }).mode).toBe("raw");
    expect(resolveRtkPolicy("npm install left-pad", { rtkAvailable: true }).mode).toBe("raw");
    // === END_BLOCK_ASSERT_CLASSIFICATION_GUARDS ===
  });

  it("diagnoses RTK health and parses savings through injectable runners", () => {
    // === START_BLOCK_ASSERT_HEALTH_AND_SAVINGS ===
    const runner: RtkCommandRunner = (_binary, args) => {
      if (args[0] === "--version") {
        return { status: 0, stdout: "rtk 0.9.0\n", stderr: "" };
      }
      return { status: 0, stdout: "saved 12,345 tokens (67.8%)\n", stderr: "" };
    };

    expect(diagnoseRtk({ runner })).toMatchObject({
      status: "ok",
      available: true,
      version: "rtk 0.9.0",
    });
    expect(readRtkSavings(tmp, { runner })).toMatchObject({
      available: true,
      tokensSaved: 12345,
      percentSaved: 67.8,
    });
    // === END_BLOCK_ASSERT_HEALTH_AND_SAVINGS ===
  });

  it("shows the RTK effective command in approval prompts before execution", async () => {
    // === START_BLOCK_ASSERT_APPROVAL_PAYLOAD ===
    const registry = new ToolRegistry();
    registerShellTools(registry, { rootDir: tmp, rtk: { available: true } });
    const gate = new SpyGate();

    const out = await registry.dispatch(
      "run_command",
      JSON.stringify({ command: "npm run build" }),
      {
        confirmationGate: gate,
      },
    );

    expect(out).toContain("user denied: rtk npm run build");
    expect(gate.lastCall).not.toBeNull();
    expect(gate.lastCall!.payload).toMatchObject({
      command: "rtk npm run build",
      cwd: tmp,
    });
    // === END_BLOCK_ASSERT_APPROVAL_PAYLOAD ===
  });
});
