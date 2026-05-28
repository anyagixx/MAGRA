// === MODULE_CONTRACT ===
// FILE: tests/magra/reasonix-base.test.ts
// VERSION: 1.0.0
// PURPOSE: Verify the imported Reasonix base exposes the MAGRA baseline package surface.
// SCOPE: Package metadata, compatibility command aliases, and core source directories.
// DEPENDS: M-REASONIX-BASE
// LINKS: docs/verification/V-M-REASONIX-BASE.xml
// ROLE: TEST
// MAP_MODE: LOCALS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: readJson, rootPath
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial MAGRA baseline test for imported Reasonix source.
// === END_CHANGE_SUMMARY ===

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootPath = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

describe("MAGRA Reasonix base import", () => {
  it("keeps MAGRA package identity with Reasonix-compatible command aliases", () => {
    // === START_BLOCK_READ_PACKAGE_METADATA ===
    const pkg = readJson<{
      name: string;
      description: string;
      bin: Record<string, string>;
      scripts: Record<string, string>;
    }>(join(rootPath, "package.json"));
    // === END_BLOCK_READ_PACKAGE_METADATA ===

    // === START_BLOCK_ASSERT_PACKAGE_SURFACE ===
    expect(pkg.name).toBe("magra");
    expect(pkg.description).toContain("MAGRA");
    expect(pkg.bin.magra).toBe("dist/cli/index.js");
    expect(pkg.bin.reasonix).toBe("dist/cli/index.js");
    expect(pkg.bin.dsnix).toBe("dist/cli/index.js");
    expect(pkg.scripts.build).toContain("tsup");
    expect(pkg.scripts.typecheck).toContain("tsc --noEmit");
    expect(pkg.scripts.test).toBe("vitest run");
    // === END_BLOCK_ASSERT_PACKAGE_SURFACE ===
  });

  it("includes the core Reasonix runtime, dashboard, and MAGRA attribution files", () => {
    // === START_BLOCK_ASSERT_IMPORTED_PATHS ===
    expect(existsSync(join(rootPath, "src", "cli", "index.ts"))).toBe(true);
    expect(existsSync(join(rootPath, "src", "loop.ts"))).toBe(true);
    expect(existsSync(join(rootPath, "dashboard", "src", "App.tsx"))).toBe(true);
    expect(existsSync(join(rootPath, "MAGRA.md"))).toBe(true);
    expect(existsSync(join(rootPath, "docs", "graph-index.xml"))).toBe(true);
    // === END_BLOCK_ASSERT_IMPORTED_PATHS ===
  });
});
