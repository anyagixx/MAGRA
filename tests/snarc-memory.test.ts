// === MODULE_CONTRACT ===
// FILE: tests/snarc-memory.test.ts
// VERSION: 1.0.0
// PURPOSE: Verify MAGRA SNARC memory capture, retrieval, briefing, consolidation, and bounded failure behavior.
// SCOPE: Salience-gated storage, provenance labels, redaction, search ranking, pattern extraction, and corrupt-store handling.
// DEPENDS: M-SNARC-MEMORY
// LINKS: docs/verification/V-M-SNARC-MEMORY.xml
// ROLE: TEST
// MAP_MODE: LOCALS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: SNARC memory unit assertions
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial verification for MAGRA SNARC memory runtime.
// === END_CHANGE_SUMMARY ===

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  captureObservation,
  getSessionBriefing,
  listSnarcPatterns,
  readSnarcStats,
  redactSnarcText,
  resolveSnarcMemoryPath,
  runConsolidation,
  searchMemory,
} from "../src/snarc/memory.js";

describe("SNARC memory", () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), "magra-snarc-memory-"));
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it("captures salient observations and searches them with provenance labels", () => {
    // === START_BLOCK_ASSERT_CAPTURE_AND_SEARCH ===
    const result = captureObservation({
      rootDir,
      sessionId: "s-1",
      toolName: "run_command",
      input: "npm test -- tests/snarc-memory.test.ts",
      output: "PASS tests/snarc-memory.test.ts completed successfully with MAGRA_SNARC_PATTERN",
      metadata: { token: "sk-test-secret-should-hide-1234567890" },
    });

    expect(result.captured).toBe(true);
    expect(result.logMarker).toBe("[SnarcMemory][captureObservation][BLOCK_SCORE_SALIENCE]");
    expect(result.observation?.provenance).toBe("observed");
    expect(result.observation?.outputSummary).toContain("PASS");

    const matches = searchMemory("SNARC pattern test", { rootDir, limit: 3 });
    expect(matches[0]).toMatchObject({
      provenance: "observed",
      sessionId: "s-1",
    });
    expect(matches[0]?.summary).toContain("snarc-memory.test.ts");
    // === END_BLOCK_ASSERT_CAPTURE_AND_SEARCH ===
  });

  it("builds a conservative briefing and consolidates repeated work into inferred patterns", () => {
    // === START_BLOCK_ASSERT_BRIEFING_AND_CONSOLIDATION ===
    const tools = [
      "read_file",
      "edit_file",
      "run_command",
      "read_file",
      "edit_file",
      "run_command",
    ];
    for (const [index, toolName] of tools.entries()) {
      captureObservation({
        rootDir,
        sessionId: "s-2",
        toolName,
        input: `src/snarc/memory.ts iteration ${index}`,
        output:
          toolName === "run_command"
            ? "PASS src/snarc/memory.ts completed successfully"
            : "modified src/snarc/memory.ts",
      });
    }

    const consolidation = runConsolidation("s-2", { rootDir });
    expect(consolidation.logMarker).toBe(
      "[SnarcMemory][runConsolidation][BLOCK_CONSOLIDATE_PATTERNS]",
    );
    expect(consolidation.patternsCreated).toBeGreaterThan(0);

    const patterns = listSnarcPatterns(rootDir);
    expect(patterns.some((pattern) => pattern.provenance === "inferred")).toBe(true);

    const briefing = getSessionBriefing(rootDir, { query: "snarc memory", maxChars: 2000 });
    expect(briefing).toContain("[inferred:");
    expect(briefing).toContain("[observed:");
    // === END_BLOCK_ASSERT_BRIEFING_AND_CONSOLIDATION ===
  });

  it("redacts common secrets before writing memory", () => {
    // === START_BLOCK_ASSERT_REDACTION ===
    const redacted = redactSnarcText(
      "Authorization: Bearer abcdefghijklmnop api_key=secret-value sk-secret-value-1234567890",
    );
    expect(redacted).not.toContain("abcdefghijklmnop");
    expect(redacted).not.toContain("secret-value");

    captureObservation({
      rootDir,
      sessionId: "s-3",
      toolName: "run_command",
      input: "deploy with api_key=secret-value",
      output: "failed with Authorization: Bearer abcdefghijklmnop",
    });
    const stored = readFileSync(resolveSnarcMemoryPath(rootDir), "utf8");
    expect(stored).not.toContain("abcdefghijklmnop");
    expect(stored).not.toContain("secret-value");
    // === END_BLOCK_ASSERT_REDACTION ===
  });

  it("bounds corrupt memory errors without overwriting existing bytes", () => {
    // === START_BLOCK_ASSERT_CORRUPT_STORE_BOUNDED ===
    const path = resolveSnarcMemoryPath(rootDir);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "{not-json", "utf8");

    const result = captureObservation({
      rootDir,
      sessionId: "s-4",
      toolName: "run_command",
      input: "npm test",
      output: "PASS",
    });

    expect(result.captured).toBe(false);
    expect(result.reason).toContain("memory-load-failed");
    expect(searchMemory("npm", { rootDir })).toEqual([]);
    expect(readFileSync(path, "utf8")).toBe("{not-json");

    const stats = readSnarcStats(rootDir);
    expect(stats.available).toBe(false);
    // === END_BLOCK_ASSERT_CORRUPT_STORE_BOUNDED ===
  });
});
