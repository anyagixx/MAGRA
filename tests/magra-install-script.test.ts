// === MODULE_CONTRACT ===
// FILE: tests/magra-install-script.test.ts
// VERSION: 1.0.0
// PURPOSE: Verify the MAGRA GitHub one-command installer is safe, documented, and dry-run capable.
// SCOPE: scripts/install.sh content, dry-run behavior, dependency gates, env overrides, and release URL contract.
// DEPENDS: M-MAGRA-INSTALL-SCRIPT
// LINKS: docs/verification/V-M-MAGRA-INSTALL-SCRIPT.xml
// ROLE: TEST
// MAP_MODE: LOCALS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: install script reader, dry-run executor, safety assertions
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial MAGRA install script verification.
// Updated pinned dry-run reference for the hotfix release.
// === END_CHANGE_SUMMARY ===

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const INSTALL_SCRIPT_PATH = join(ROOT, "scripts", "install.sh");
const INSTALL_SCRIPT = readFileSync(INSTALL_SCRIPT_PATH, "utf8");

describe("MAGRA GitHub installer", () => {
  it("pins the official repository and one-command install URL", () => {
    // === START_BLOCK_ASSERT_OFFICIAL_REPO ===
    expect(INSTALL_SCRIPT).toContain("https://github.com/anyagixx/MAGRA.git");
    expect(INSTALL_SCRIPT).toContain(
      "https://raw.githubusercontent.com/anyagixx/MAGRA/main/scripts/install.sh",
    );
    expect(INSTALL_SCRIPT).toContain("MAGRA_REF");
    expect(INSTALL_SCRIPT).toContain("MAGRA_INSTALL_DIR");
    expect(INSTALL_SCRIPT).toContain("MAGRA_BIN_DIR");
    // === END_BLOCK_ASSERT_OFFICIAL_REPO ===
  });

  it("does not require privileged installation", () => {
    // === START_BLOCK_ASSERT_NO_SUDO ===
    expect(INSTALL_SCRIPT).not.toMatch(/\bsudo\b/);
    expect(INSTALL_SCRIPT).not.toMatch(/\bchown\b/);
    expect(INSTALL_SCRIPT).not.toMatch(/\/usr\/local\/bin/);
    expect(INSTALL_SCRIPT).toContain("$HOME/.local/bin");
    // === END_BLOCK_ASSERT_NO_SUDO ===
  });

  it("checks required tools and Node 22 before installation work", () => {
    // === START_BLOCK_ASSERT_DEPENDENCY_GATES ===
    expect(INSTALL_SCRIPT).toContain("require_command git");
    expect(INSTALL_SCRIPT).toContain("require_command npm");
    expect(INSTALL_SCRIPT).toContain("require_node");
    expect(INSTALL_SCRIPT).toContain("major >= 22");
    const mainBlock = INSTALL_SCRIPT.slice(INSTALL_SCRIPT.indexOf("main()"));
    expect(mainBlock.indexOf("require_command git")).toBeLessThan(
      mainBlock.indexOf("clone_or_update_repo"),
    );
    // === END_BLOCK_ASSERT_DEPENDENCY_GATES ===
  });

  it("supports idempotent clone update, ref checkout, build, and shim creation", () => {
    // === START_BLOCK_ASSERT_IDEMPOTENT_FLOW ===
    expect(INSTALL_SCRIPT).toContain("git fetch --tags --prune origin");
    expect(INSTALL_SCRIPT).toMatch(/git\b[\s\S]*checkout -B/);
    expect(INSTALL_SCRIPT).toContain("npm ci");
    expect(INSTALL_SCRIPT).toContain("npm run build");
    expect(INSTALL_SCRIPT).toContain("exec node");
    expect(INSTALL_SCRIPT).toContain("chmod +x");
    // === END_BLOCK_ASSERT_IDEMPOTENT_FLOW ===
  });

  it("dry-runs without cloning, building, or writing a shim", () => {
    // === START_BLOCK_ASSERT_DRY_RUN ===
    const tempRoot = mkdtempSync(join(tmpdir(), "magra-install-test-"));
    try {
      const output = execFileSync("bash", [INSTALL_SCRIPT_PATH, "--dry-run"], {
        cwd: ROOT,
        encoding: "utf8",
        env: {
          ...process.env,
          MAGRA_INSTALL_DIR: join(tempRoot, "repo"),
          MAGRA_BIN_DIR: join(tempRoot, "bin"),
          MAGRA_REF: "v0.1.1",
        },
      });

      expect(output).toContain("[MagraInstallScript][main] BLOCK_VALIDATE_TOOLS");
      expect(output).toContain("git clone");
      expect(output).toContain("v0.1.1");
      expect(output).toContain("npm ci");
      expect(output).toContain("npm run build");
      expect(output).toContain("write shim");
      expect(output).toContain("magra --version");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
    // === END_BLOCK_ASSERT_DRY_RUN ===
  });
});
