// === MODULE_CONTRACT ===
// FILE: tests/magra-release-surface.test.ts
// VERSION: 1.0.0
// PURPOSE: Verify MAGRA release docs and package metadata are MAGRA-first.
// SCOPE: README install commands, localized READMEs, package metadata, docs-site entry surfaces, release docs, NOTICE, and current changelog entries.
// DEPENDS: M-MAGRA-RELEASE-SURFACE,M-MAGRA-LOCALIZED-READMES,M-MAGRA-PACKAGE-README-GATE,M-MAGRA-DOCS-SITE-SURFACE
// LINKS: docs/verification/V-M-MAGRA-RELEASE-SURFACE.xml
// ROLE: TEST
// MAP_MODE: LOCALS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: release surface document readers, Reasonix context classifier, package README parser, MAGRA-first assertions
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial MAGRA release surface verification.
// Updated expected release version for the MyGRACE skill asset hotfix.
// Added localized README, package README set, and docs-site entry surface gates.
// === END_CHANGE_SUMMARY ===

import { spawnSync } from "node:child_process";
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

interface PackPreview {
  files: Array<{ path: string }>;
}

const ROOT = process.cwd();
const readText = (path: string) => readFileSync(join(ROOT, path), "utf8");
const readPackage = (): PackageMetadata => JSON.parse(readText("package.json")) as PackageMetadata;

const LOCALIZED_README_DOCS = [
  { path: "README.zh-CN.md", content: readText("README.zh-CN.md") },
  { path: "README.ja-JP.md", content: readText("README.ja-JP.md") },
];

const DOCS_SITE_ENTRY_DOCS = [
  { path: "docs/index.html", content: readText("docs/index.html") },
  { path: "docs/src/install.jsx", content: readText("docs/src/install.jsx") },
  { path: "docs/src/nav.jsx", content: readText("docs/src/nav.jsx") },
  { path: "docs/src/footer.jsx", content: readText("docs/src/footer.jsx") },
  { path: "docs/src/hero.jsx", content: readText("docs/src/hero.jsx") },
];

const RELEASE_SURFACE_DOCS = [
  { path: "README.md", content: readText("README.md") },
  ...LOCALIZED_README_DOCS,
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
    expect(readme).toContain("MAGRA_REF=v0.1.2");
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
    expect(pkg.version).toBe("0.1.2");
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

  it("keeps localized READMEs MAGRA-first", () => {
    // === START_BLOCK_ASSERT_LOCALIZED_READMES ===
    for (const doc of LOCALIZED_README_DOCS) {
      assertMagraFirstReadme(doc.path, doc.content);
      expect(doc.content).toContain("curl -fsSL https://raw.githubusercontent.com/anyagixx/MAGRA");
      expect(doc.content).toContain("MAGRA_REF=v0.1.2");
      expect(doc.content).toContain("npm install -g magra");
      expect(doc.content).toContain("npx magra@latest code");
      expect(doc.content).toContain("/mygrace:status");
      expect(doc.content).toContain("RTK");
      expect(doc.content).toContain("SNARC");
    }
    // === END_BLOCK_ASSERT_LOCALIZED_READMES ===
  });

  it("checks every README included in the npm package preview", () => {
    // === START_BLOCK_ASSERT_PACKAGED_READMES ===
    const preview = readPackPreview();
    const packageReadmes = preview.files
      .map((file) => file.path)
      .filter((path) => /^README(?:\..+)?\.md$/.test(path))
      .sort();
    expect(packageReadmes).toEqual(["README.ja-JP.md", "README.md", "README.zh-CN.md"]);
    for (const path of packageReadmes) {
      assertMagraFirstReadme(path, readText(path));
    }
    expect(preview.files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        "dist/cli/skill-bodies/init.md",
        "dist/skill-bodies/init.md",
        "scripts/install.sh",
      ]),
    );
    // === END_BLOCK_ASSERT_PACKAGED_READMES ===
  });

  it("keeps docs-site entry and install surfaces MAGRA-first", () => {
    // === START_BLOCK_ASSERT_DOCS_SITE_SURFACE ===
    const docsIndex = readText("docs/index.html");
    const docsInstall = readText("docs/src/install.jsx");
    const combined = DOCS_SITE_ENTRY_DOCS.map((doc) => doc.content).join("\n");
    expect(docsIndex).toContain("<title>MAGRA");
    expect(docsIndex).toContain('"name": "MAGRA"');
    expect(docsIndex).toContain("https://github.com/anyagixx/MAGRA");
    expect(docsInstall).toContain(
      "curl -fsSL https://raw.githubusercontent.com/anyagixx/MAGRA/main/scripts/install.sh | bash",
    );
    expect(docsInstall).toContain("npm install -g magra && magra code");
    expect(docsInstall).toContain("npx magra@latest code");
    expect(combined).not.toContain("npx reasonix code");
    expect(combined).not.toContain("npm install -g reasonix");
    expect(combined).not.toContain("git clone https://github.com/esengine/DeepSeek-Reasonix");
    // === END_BLOCK_ASSERT_DOCS_SITE_SURFACE ===
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
    expect(changelog).toContain("## [0.1.2] - 2026-05-29");
    // === END_BLOCK_ASSERT_RELEASE_DOCS ===
  });
});

function currentMagraChangelog(changelog: string): string {
  const start = changelog.indexOf("## [MAGRA release surface]");
  const end = changelog.indexOf("## [0.52.0]");
  if (start === -1 || end === -1 || end <= start) return changelog;
  return changelog.slice(0, end);
}

function assertMagraFirstReadme(path: string, content: string): void {
  expect(content, path).toContain("# MAGRA");
  expect(content, path).toContain("magra code");
  expect(content, path).toContain("MyGRACE");
  expect(content, path).not.toMatch(/\bnpm\s+install\s+-g\s+reasonix\b/i);
  expect(content, path).not.toMatch(/\bnpx\s+reasonix(?:@latest)?\s+code\b/i);
  expect(content, path).not.toMatch(/npmjs\.com\/package\/reasonix/i);
  expect(content, path).not.toMatch(/github\.com\/esengine\/reasonix\/actions/i);
}

function readPackPreview(): PackPreview {
  const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, npm_config_loglevel: "silent" },
  });
  if (result.status !== 0) {
    throw new Error(
      `npm pack preview failed with status ${result.status}:\n${result.stdout}\n${result.stderr}`,
    );
  }
  const jsonStart = result.stdout.search(/\[\s*\{/);
  if (jsonStart < 0) {
    throw new Error(`npm pack preview did not emit JSON:\n${result.stdout}`);
  }
  const parsed = JSON.parse(result.stdout.slice(jsonStart)) as PackPreview[];
  const first = parsed[0];
  if (!first) throw new Error("npm pack preview was empty");
  return first;
}
