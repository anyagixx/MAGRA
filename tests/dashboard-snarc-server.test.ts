// === MODULE_CONTRACT ===
// FILE: tests/dashboard-snarc-server.test.ts
// VERSION: 1.0.0
// PURPOSE: Verify MAGRA dashboard SNARC API visibility for memory health and search.
// SCOPE: `/api/snarc` read-only stats, search, patterns, and identity endpoints.
// DEPENDS: M-SNARC-MEMORY,M-SNARC-LOOP-ADAPTER
// LINKS: docs/verification/V-M-SNARC-MEMORY.xml
// ROLE: TEST
// MAP_MODE: LOCALS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: dashboard SNARC API assertions
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial verification for dashboard SNARC read-only endpoints.
// === END_CHANGE_SUMMARY ===

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleSnarc } from "../src/server/api/snarc.js";
import { captureObservation } from "../src/snarc/memory.js";

describe("dashboard SNARC API", () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), "magra-dashboard-snarc-"));
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it("returns stats and searchable provenance-labeled memory", async () => {
    // === START_BLOCK_ASSERT_SNARC_API ===
    captureObservation({
      rootDir,
      sessionId: "dash-1",
      toolName: "run_command",
      input: "npm test dashboard SNARC visibility",
      output: "PASS dashboard SNARC search visibility",
    });

    const ctx = {
      configPath: "",
      usageLogPath: "",
      mode: "attached" as const,
      getCurrentCwd: () => rootDir,
    };

    const stats = await handleSnarc("GET", [], "", ctx, new URLSearchParams());
    expect(stats.status).toBe(200);
    expect((stats.body as { stats: { observations: number } }).stats.observations).toBe(1);

    const search = await handleSnarc(
      "GET",
      ["search"],
      "",
      ctx,
      new URLSearchParams({ query: "SNARC visibility" }),
    );
    expect(search.status).toBe(200);
    expect((search.body as { results: Array<{ provenance: string }> }).results[0]?.provenance).toBe(
      "observed",
    );
    // === END_BLOCK_ASSERT_SNARC_API ===
  });
});
