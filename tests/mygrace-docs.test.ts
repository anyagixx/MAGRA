// === MODULE_CONTRACT ===
// FILE: tests/mygrace-docs.test.ts
// VERSION: 1.0.0
// PURPOSE: Verify MAGRA MyGRACE docs helpers.
// SCOPE: Index loading, lazy entity lookup, linting, and module delta writes.
// DEPENDS: M-MYGRACE-DOCS
// LINKS: docs/verification/V-M-MYGRACE-DOCS.xml
// ROLE: TEST
// MAP_MODE: LOCALS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: MyGRACE docs helper unit assertions
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial tests for MAGRA MyGRACE docs integration.
// === END_CHANGE_SUMMARY ===

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  lintMyGraceArtifacts,
  loadGraphIndex,
  loadModule,
  loadPhase,
  loadVerification,
  writeModuleDelta,
} from "../src/mygrace/docs.js";

describe("MyGRACE docs helpers", () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("loads indexes first and resolves per-entity files lazily", () => {
    // === START_BLOCK_ASSERT_INDEX_FIRST_LOADS ===
    const graph = loadGraphIndex(process.cwd());
    expect(graph.entries.map((entry) => entry.id)).toContain("M-MYGRACE-DOCS");

    const module = loadModule(process.cwd(), "M-MYGRACE-DOCS");
    expect(module.sourcePath).toBe("src/mygrace/docs.ts");
    expect(module.verificationRef).toBe("V-M-MYGRACE-DOCS");

    const phase = loadPhase(process.cwd(), "Phase-2");
    expect(phase.content).toContain("MyGraceCore");

    const verification = loadVerification(process.cwd(), "V-M-MYGRACE-DOCS");
    expect(verification.content).toContain("tests/mygrace-docs.test.ts");
    // === END_BLOCK_ASSERT_INDEX_FIRST_LOADS ===
  });

  it("reports the current MAGRA MyGRACE artifacts as lint-clean", () => {
    // === START_BLOCK_ASSERT_LINT_REPORT ===
    const report = lintMyGraceArtifacts(process.cwd());
    expect(report.errors).toBe(0);
    expect(report.warnings).toBe(0);
    // === END_BLOCK_ASSERT_LINT_REPORT ===
  });

  it("updates graph-index and per-module status through a bounded module delta", () => {
    // === START_BLOCK_CREATE_TEMP_PROJECT ===
    const root = mkdtempSync(join(tmpdir(), "magra-mygrace-"));
    tempRoots.push(root);
    mkdirSync(join(root, "docs", "modules"), { recursive: true });
    mkdirSync(join(root, "docs", "plans"), { recursive: true });
    mkdirSync(join(root, "docs", "verification"), { recursive: true });
    writeFileSync(
      join(root, "docs", "graph-index.xml"),
      '<GraphIndex project="TMP"><M-TMP NAME="Tmp" TYPE="UTILITY" STATUS="pending" PATH="src/tmp.ts" DEPENDS="" VERIFICATION_REF="V-M-TMP" /></GraphIndex>',
    );
    writeFileSync(join(root, "docs", "plan-index.xml"), '<PlanIndex project="TMP" />');
    writeFileSync(
      join(root, "docs", "verification-index.xml"),
      '<VerificationIndex project="TMP"><V-M-TMP MODULE="M-TMP" PRIORITY="high" STATUS="pending" /></VerificationIndex>',
    );
    writeFileSync(
      join(root, "docs", "modules", "M-TMP.xml"),
      '<M-TMP NAME="Tmp" TYPE="UTILITY" STATUS="pending"><contract><source-path>src/tmp.ts</source-path><verification-ref>V-M-TMP</verification-ref></contract></M-TMP>',
    );
    writeFileSync(
      join(root, "docs", "verification", "V-M-TMP.xml"),
      '<V-M-TMP MODULE="M-TMP" PRIORITY="high" STATUS="pending" />',
    );
    // === END_BLOCK_CREATE_TEMP_PROJECT ===

    // === START_BLOCK_ASSERT_DELTA_WRITE ===
    const result = writeModuleDelta(root, {
      moduleId: "M-TMP",
      status: "done",
      path: "src/tmp.ts",
    });
    expect(result.changedFiles).toEqual(["docs/graph-index.xml", "docs/modules/M-TMP.xml"]);
    expect(loadGraphIndex(root).entries[0]?.attrs.STATUS).toBe("done");
    expect(readFileSync(join(root, "docs", "modules", "M-TMP.xml"), "utf8")).toContain(
      'STATUS="done"',
    );
    // === END_BLOCK_ASSERT_DELTA_WRITE ===
  });
});
