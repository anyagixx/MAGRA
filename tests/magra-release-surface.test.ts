// === MODULE_CONTRACT ===
// FILE: tests/magra-release-surface.test.ts
// VERSION: 1.0.0
// PURPOSE: Verify MAGRA release docs and package metadata are MAGRA-first.
// SCOPE: README install commands, package metadata, release docs, NOTICE, and current changelog entries.
// DEPENDS: M-MAGRA-RELEASE-SURFACE
// LINKS: docs/verification/V-M-MAGRA-RELEASE-SURFACE.xml
// ROLE: TEST
// MAP_MODE: LOCALS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: release surface document readers, Reasonix context classifier, package metadata assertions
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial MAGRA release surface verification.
// Updated expected release version for the MyGRACE skill asset hotfix.
// === END_CHANGE_SUMMARY ===

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface PackageMetadata {
  name: string;
  version: string;
  description: string;
  bin: Record<string, string>;
  repository: { type: string; url: string };
  bugs: { url: string };
  homepage: string;
  files: string[];
}

const ROOT = process.cwd();
const readText = (path: string) => readFileSync(join(ROOT, path), "utf8");
const readPackage = (): PackageMetadata => JSON.parse(readText("package.json")) as PackageMetadata;

const RELEASE_SURFACE_DOCS = [
  { path: "README.md", content: readText("README.md") },
  { path: "NOTICE.md", content: readText("NOTICE.md") },
  {
    path: "CHANGELOG.md",
    content: currentMagraChangelog(readText("CHANGELOG.md")),
  },
  {
    path: "docs/release/MAGRA-release-checklist.md",
    content: readText("docs/release/MAGRA-release-checklist.md"),
  },
  {
    path: "docs/operations/MAGRA-operator-flows.md",
    content: readText("docs/operations/MAGRA-operator-flows.md"),
  },
];

const ALLOWED_REASONIX_CONTEXT =
  /\b(upstream|attribution|compatib\w*|alias(?:es)?|legacy|base runtime|reasonix-compatible|inherited|migration|history|preserv\w*|DeepSeek-Reasonix)\b/i;

describe("MAGRA release surface", () => {
  it("uses MAGRA-first install and quickstart commands in README", () => {
    // === START_BLOCK_ASSERT_README_INSTALL ===
    const readme = readText("README.md");
    expect(readme).toContain(
      "curl -fsSL https://raw.githubusercontent.com/anyagixx/MAGRA/main/scripts/install.sh | bash",
    );
    expect(readme).toContain("MAGRA_REF=v0.1.1");
    expect(readme).toContain("npm install -g magra");
    expect(readme).toContain("magra code my-project");
    expect(readme).toContain("npx magra@latest code");
    expect(readme).toContain("/mygrace:execute");
    expect(readme).not.toContain("npm install -g reasonix");
    expect(readme).not.toContain("npx reasonix code");
    expect(readme).not.toContain("npx reasonix@latest");
    // === END_BLOCK_ASSERT_README_INSTALL ===
  });

  it("points package metadata at MAGRA surfaces while preserving compatibility bins", () => {
    // === START_BLOCK_ASSERT_PACKAGE_METADATA ===
    const pkg = readPackage();
    expect(pkg.name).toBe("magra");
    expect(pkg.version).toBe("0.1.1");
    expect(pkg.description).toMatch(/^MAGRA:/);
    expect(pkg.repository.url).toBe("git+https://github.com/anyagixx/MAGRA.git");
    expect(pkg.bugs.url).toBe("https://github.com/anyagixx/MAGRA/issues");
    expect(pkg.homepage).toBe("https://github.com/anyagixx/MAGRA#readme");
    expect(pkg.repository.url).not.toMatch(/DeepSeek-Reasonix|reasonix/i);
    expect(pkg.bugs.url).not.toMatch(/DeepSeek-Reasonix|reasonix/i);
    expect(pkg.homepage).not.toMatch(/DeepSeek-Reasonix|reasonix/i);
    expect(pkg.bin).toMatchObject({
      magra: "dist/cli/index.js",
      reasonix: "dist/cli/index.js",
      dsnix: "dist/cli/index.js",
    });
    expect(pkg.files).toEqual(
      expect.arrayContaining([
        "README.md",
        "CHANGELOG.md",
        "NOTICE.md",
        "LICENSE",
        "scripts/install.sh",
      ]),
    );
    // === END_BLOCK_ASSERT_PACKAGE_METADATA ===
  });

  it("allows Reasonix only as attribution, upstream, or compatibility context", () => {
    // === START_BLOCK_ASSERT_REASONIX_CONTEXT ===
    const offenders: string[] = [];
    for (const doc of RELEASE_SURFACE_DOCS) {
      doc.content.split("\n").forEach((line, index) => {
        if (!/reasonix/i.test(line)) return;
        if (/M-REASONIX-BASE/.test(line)) return;
        if (ALLOWED_REASONIX_CONTEXT.test(line)) return;
        offenders.push(`${doc.path}:${index + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
    // === END_BLOCK_ASSERT_REASONIX_CONTEXT ===
  });

  it("documents current MAGRA release operations and SNARC SQLite storage", () => {
    // === START_BLOCK_ASSERT_RELEASE_DOCS ===
    const checklist = readText("docs/release/MAGRA-release-checklist.md");
    const operatorFlows = readText("docs/operations/MAGRA-operator-flows.md");
    const notice = readText("NOTICE.md");
    const changelog = readText("CHANGELOG.md");
    expect(checklist).toContain("repository, bugs, and homepage point to MAGRA");
    expect(checklist).toContain("README.md` install and quickstart commands use `magra");
    expect(checklist).toContain("scripts/install.sh --dry-run");
    expect(operatorFlows).toContain(".magra/snarc/memory.sqlite");
    expect(notice).toContain("DeepSeek-Reasonix / Reasonix base runtime");
    expect(changelog).toContain("## [0.1.1] - 2026-05-29");
    // === END_BLOCK_ASSERT_RELEASE_DOCS ===
  });
});

function currentMagraChangelog(changelog: string): string {
  const start = changelog.indexOf("## [MAGRA release surface]");
  const end = changelog.indexOf("## [0.52.0]");
  if (start === -1 || end === -1 || end <= start) return changelog;
  return changelog.slice(0, end);
}
