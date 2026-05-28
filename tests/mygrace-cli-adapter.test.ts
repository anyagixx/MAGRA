// === MODULE_CONTRACT ===
// FILE: tests/mygrace-cli-adapter.test.ts
// VERSION: 1.0.0
// PURPOSE: Verify Node-native MyGRACE CLI adapter behavior.
// SCOPE: Module, phase, verification, lint, and file-markup rendering.
// DEPENDS: M-MYGRACE-CLI-ADAPTER
// LINKS: docs/verification/V-M-MYGRACE-CLI-ADAPTER.xml
// ROLE: TEST
// MAP_MODE: LOCALS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: MyGRACE CLI adapter unit assertions
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial tests for MAGRA MyGRACE CLI adapter.
// === END_CHANGE_SUMMARY ===

import { describe, expect, it } from "vitest";
import {
  mygraceFileShow,
  mygraceLint,
  mygraceModuleFind,
  mygraceModuleIndex,
  mygraceModuleShow,
  mygracePhaseShow,
  mygraceVerificationIndex,
  renderMyGraceLintReport,
} from "../src/mygrace/cli-adapter.js";

describe("MyGRACE CLI adapter", () => {
  it("renders index and lookup output from MAGRA artifacts", () => {
    // === START_BLOCK_ASSERT_CLI_INDEX_OUTPUT ===
    expect(mygraceModuleIndex(process.cwd())).toContain('<GraphIndex project="MAGRA"');
    expect(mygraceVerificationIndex(process.cwd())).toContain("V-M-MYGRACE-DOCS");

    const found = mygraceModuleFind(process.cwd(), "MyGraceDocs");
    expect(found).toContain("M-MYGRACE-DOCS");
    expect(found).toContain("src/mygrace/docs.ts");
    // === END_BLOCK_ASSERT_CLI_INDEX_OUTPUT ===
  });

  it("shows module, verification, and phase XML without scanning unrelated entities", () => {
    // === START_BLOCK_ASSERT_CLI_SHOW_OUTPUT ===
    const moduleOutput = mygraceModuleShow(process.cwd(), "M-MYGRACE-DOCS", {
      withVerification: true,
    });
    expect(moduleOutput).toContain("=== M-MYGRACE-DOCS ===");
    expect(moduleOutput).toContain("=== V-M-MYGRACE-DOCS ===");

    const phaseOutput = mygracePhaseShow(process.cwd(), "Phase-2");
    expect(phaseOutput).toContain("MyGraceCore");
    // === END_BLOCK_ASSERT_CLI_SHOW_OUTPUT ===
  });

  it("renders file-local contracts and semantic block counts", () => {
    // === START_BLOCK_ASSERT_FILE_SHOW ===
    const output = mygraceFileShow(process.cwd(), "src/mygrace/docs.ts", {
      contracts: true,
      blocks: true,
    });
    expect(output).toContain("MODULE_CONTRACT");
    expect(output).toContain("CONTRACTS");
    expect(output).toContain("SEMANTIC BLOCKS");
    expect(output).toContain("Status: Paired");
    // === END_BLOCK_ASSERT_FILE_SHOW ===
  });

  it("returns structured lint and recognizable text output", () => {
    // === START_BLOCK_ASSERT_ADAPTER_LINT ===
    const report = mygraceLint(process.cwd());
    expect(report.errors).toBe(0);
    expect(renderMyGraceLintReport(report)).toContain("MyGRACE Lint Report");
    // === END_BLOCK_ASSERT_ADAPTER_LINT ===
  });
});
