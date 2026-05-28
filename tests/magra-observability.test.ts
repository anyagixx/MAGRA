// === MODULE_CONTRACT ===
// FILE: tests/magra-observability.test.ts
// VERSION: 1.0.0
// PURPOSE: Verify MAGRA observability helper behavior.
// SCOPE: Health reports, verification command registry, and log marker formatting.
// DEPENDS: M-OBSERVABILITY-VERIFICATION
// LINKS: docs/verification/V-M-OBSERVABILITY-VERIFICATION.xml
// ROLE: TEST
// MAP_MODE: LOCALS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: MAGRA observability unit assertions
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial tests for MAGRA observability helpers.
// === END_CHANGE_SUMMARY ===

import { describe, expect, it } from "vitest";
import {
  MAGRA_PROJECT_NAME,
  formatLogMarker,
  getMagraHealth,
  listVerificationCommands,
} from "../src/magra/observability.js";

describe("MAGRA observability", () => {
  it("formats stable MyGRACE-compatible log markers", () => {
    // === START_BLOCK_ASSERT_LOG_MARKER ===
    expect(
      formatLogMarker("ObservabilityVerification", "getMagraHealth", "BLOCK_COLLECT_HEALTH"),
    ).toBe("[ObservabilityVerification][getMagraHealth][BLOCK_COLLECT_HEALTH]");
    // === END_BLOCK_ASSERT_LOG_MARKER ===
  });

  it("rejects malformed marker parts", () => {
    // === START_BLOCK_ASSERT_MARKER_VALIDATION ===
    expect(() => formatLogMarker("ObservabilityVerification", "", "BLOCK_COLLECT_HEALTH")).toThrow(
      "non-empty",
    );
    expect(() =>
      formatLogMarker("ObservabilityVerification", "getMagraHealth", "[BLOCK_COLLECT_HEALTH]"),
    ).toThrow("square brackets");
    // === END_BLOCK_ASSERT_MARKER_VALIDATION ===
  });

  it("builds a MAGRA health report with explicit component state", () => {
    // === START_BLOCK_ASSERT_HEALTH_REPORT ===
    const report = getMagraHealth({
      mygrace: { status: "ok", detail: "MyGRACE adapter ready." },
      rtk: { status: "ok", detail: "RTK detected.", version: "0.35.0" },
      snarc: { status: "ok", detail: "SNARC memory ready." },
      mcp: { status: "ok", detail: "MCP bridge ready." },
    });

    expect(report.projectName).toBe(MAGRA_PROJECT_NAME);
    expect(report.overallStatus).toBe("ok");
    expect(report.components.rtk.version).toBe("0.35.0");
    // === END_BLOCK_ASSERT_HEALTH_REPORT ===
  });

  it("lists scoped verification commands without exposing mutable shared state", () => {
    // === START_BLOCK_ASSERT_VERIFICATION_COMMANDS ===
    const moduleCommands = listVerificationCommands("module");
    expect(moduleCommands.map((command) => command.moduleId)).toEqual([
      "M-OBSERVABILITY-VERIFICATION",
      "M-RTK-SHELL-POLICY",
      "M-SNARC-MEMORY",
      "M-SNARC-LOOP-ADAPTER",
      "M-MCP-UNIFIED-BRIDGE",
      "M-SNARC-DASHBOARD-API",
    ]);
    const observability = moduleCommands.find(
      (command) => command.moduleId === "M-OBSERVABILITY-VERIFICATION",
    );
    expect(observability).toBeDefined();
    observability!.command = "mutated";

    const freshCommands = listVerificationCommands("module");
    expect(
      freshCommands.find((command) => command.moduleId === "M-OBSERVABILITY-VERIFICATION")?.command,
    ).toBe("rtk npm test -- tests/magra-observability.test.ts");
    // === END_BLOCK_ASSERT_VERIFICATION_COMMANDS ===
  });
});
