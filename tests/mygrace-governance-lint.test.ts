// === MODULE_CONTRACT ===
// FILE: tests/mygrace-governance-lint.test.ts
// VERSION: 1.0.0
// PURPOSE: Verify MAGRA MyGRACE governance lint catches managed-file drift.
// SCOPE: Graph-index managed files, approved release docs, required metadata, and exact semantic block pairing.
// DEPENDS: M-MYGRACE-GOVERNANCE-LINT
// LINKS: docs/verification/V-M-MYGRACE-GOVERNANCE-LINT.xml
// ROLE: TEST
// MAP_MODE: LOCALS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: temporary MyGRACE project fixtures and governance lint assertions
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial negative fixture coverage for Phase-10 MyGRACE governance lint.
// === END_CHANGE_SUMMARY ===

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  discoverManagedFiles,
  lintManagedFileMarkup,
  lintMyGraceArtifacts,
} from "../src/mygrace/docs.js";

interface ProjectEntry {
  id: string;
  path: string;
  content: string;
  type?: string;
}

interface MarkupOptions {
  includeContract?: boolean;
  includeMap?: boolean;
  includeChangeSummary?: boolean;
  body?: string;
}

describe("MyGRACE governance lint", () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("discovers graph-index PATH files and approved release docs", () => {
    // === START_BLOCK_ASSERT_DISCOVERY ===
    const root = createTempProject(
      [
        {
          id: "M-TMP",
          path: "src/managed.ts",
          content: sourceMarkup("src/managed.ts"),
        },
      ],
      { "MAGRA-release.md": releaseMarkup("docs/release/MAGRA-release.md") },
    );
    tempRoots.push(root);

    const files = discoverManagedFiles(root);
    expect(files.map((file) => file.path)).toEqual([
      "docs/release/MAGRA-release.md",
      "src/managed.ts",
    ]);
    expect(files.find((file) => file.path === "src/managed.ts")?.source).toContain(
      "graph-index:M-TMP",
    );
    expect(files.find((file) => file.path === "docs/release/MAGRA-release.md")?.source).toContain(
      "approved-docs:docs/release",
    );
    // === END_BLOCK_ASSERT_DISCOVERY ===
  });

  it("fails graph-index managed source files that miss MODULE_MAP", () => {
    // === START_BLOCK_ASSERT_MISSING_MAP_FAILURE ===
    const root = createTempProject([
      {
        id: "M-TMP",
        path: "src/managed.ts",
        content: sourceMarkup("src/managed.ts", { includeMap: false }),
      },
    ]);
    tempRoots.push(root);

    const report = lintMyGraceArtifacts(root);
    const issue = report.issues.find(
      (candidate) =>
        candidate.file === "src/managed.ts" && candidate.message.includes("MODULE_MAP"),
    );
    expect(report.errors).toBeGreaterThan(0);
    expect(issue?.message).toContain("graph-index:M-TMP");
    // === END_BLOCK_ASSERT_MISSING_MAP_FAILURE ===
  });

  it("fails approved release docs that miss CHANGE_SUMMARY", () => {
    // === START_BLOCK_ASSERT_RELEASE_CHANGE_FAILURE ===
    const root = createTempProject(
      [
        {
          id: "M-TMP",
          path: "src/managed.ts",
          content: sourceMarkup("src/managed.ts"),
        },
      ],
      {
        "MAGRA-release.md": releaseMarkup("docs/release/MAGRA-release.md", {
          includeChangeSummary: false,
        }),
      },
    );
    tempRoots.push(root);

    const report = lintMyGraceArtifacts(root);
    const issue = report.issues.find(
      (candidate) =>
        candidate.file === "docs/release/MAGRA-release.md" &&
        candidate.message.includes("CHANGE_SUMMARY"),
    );
    expect(report.errors).toBeGreaterThan(0);
    expect(issue?.message).toContain("approved-docs:docs/release");
    // === END_BLOCK_ASSERT_RELEASE_CHANGE_FAILURE ===
  });

  it("fails mismatched semantic block names even when counts match", () => {
    // === START_BLOCK_ASSERT_BLOCK_PAIRING_FAILURE ===
    const root = createTempProject([
      {
        id: "M-TMP",
        path: "src/managed.ts",
        content: sourceMarkup("src/managed.ts", {
          body: [
            sourceCommentMarkup("START_BLOCK_ALPHA"),
            "export const managed = true;",
            sourceCommentMarkup("END_BLOCK_BETA"),
          ].join("\n"),
        }),
      },
    ]);
    tempRoots.push(root);

    const file = discoverManagedFiles(root).find(
      (candidate) => candidate.path === "src/managed.ts",
    );
    expect(file).toBeDefined();
    const issues = lintManagedFileMarkup(file!);
    expect(issues.map((issue) => issue.message).join("\n")).toContain("START_BLOCK_ALPHA");
    expect(issues.map((issue) => issue.message).join("\n")).toContain("END_BLOCK_BETA");
    // === END_BLOCK_ASSERT_BLOCK_PAIRING_FAILURE ===
  });

  it("fails dashboard graph-index paths with incomplete governance metadata", () => {
    // === START_BLOCK_ASSERT_DASHBOARD_DRIFT_FAILURE ===
    const root = createTempProject([
      {
        id: "M-DASHBOARD",
        path: "dashboard/src/ui/tool.tsx",
        type: "UI_COMPONENT",
        content: sourceMarkup("dashboard/src/ui/tool.tsx", { includeMap: false }),
      },
    ]);
    tempRoots.push(root);

    const report = lintMyGraceArtifacts(root);
    const issue = report.issues.find(
      (candidate) =>
        candidate.file === "dashboard/src/ui/tool.tsx" && candidate.message.includes("MODULE_MAP"),
    );
    expect(report.errors).toBeGreaterThan(0);
    expect(issue?.message).toContain("graph-index:M-DASHBOARD");
    // === END_BLOCK_ASSERT_DASHBOARD_DRIFT_FAILURE ===
  });

  function createTempProject(
    entries: ProjectEntry[],
    releaseFiles: Record<string, string> = {},
  ): string {
    const root = mkdtempSync(join(tmpdir(), "magra-mygrace-governance-"));
    mkdirSync(join(root, "docs", "modules"), { recursive: true });
    mkdirSync(join(root, "docs", "plans"), { recursive: true });
    mkdirSync(join(root, "docs", "verification"), { recursive: true });

    writeProjectFile(
      root,
      "docs/graph-index.xml",
      `<GraphIndex project="TMP">${entries
        .map(
          (entry) =>
            `<${entry.id} NAME="${entry.id}" TYPE="${entry.type ?? "UTILITY"}" STATUS="done" PATH="${entry.path}" DEPENDS="" VERIFICATION_REF="V-${entry.id}" />`,
        )
        .join("")}</GraphIndex>`,
    );
    writeProjectFile(root, "docs/plan-index.xml", '<PlanIndex project="TMP" />');
    writeProjectFile(
      root,
      "docs/verification-index.xml",
      `<VerificationIndex project="TMP">${entries
        .map((entry) => `<V-${entry.id} MODULE="${entry.id}" PRIORITY="high" STATUS="done" />`)
        .join("")}</VerificationIndex>`,
    );

    for (const entry of entries) {
      writeProjectFile(root, entry.path, entry.content);
      writeProjectFile(
        root,
        `docs/modules/${entry.id}.xml`,
        `<${entry.id} NAME="${entry.id}" TYPE="${entry.type ?? "UTILITY"}" STATUS="done"><contract><source-path>${entry.path}</source-path><verification-ref>V-${entry.id}</verification-ref></contract></${entry.id}>`,
      );
      writeProjectFile(
        root,
        `docs/verification/V-${entry.id}.xml`,
        `<V-${entry.id} MODULE="${entry.id}" PRIORITY="high" STATUS="done" />`,
      );
    }

    for (const [name, content] of Object.entries(releaseFiles)) {
      writeProjectFile(root, `docs/release/${name}`, content);
    }
    return root;
  }

  function sourceMarkup(path: string, options: MarkupOptions = {}): string {
    const includeContract = options.includeContract ?? true;
    const includeMap = options.includeMap ?? true;
    const includeChangeSummary = options.includeChangeSummary ?? true;
    return [
      includeContract
        ? [
            sourceCommentMarkup("MODULE_CONTRACT"),
            `// FILE: ${path}`,
            "// VERSION: 1.0.0",
            "// PURPOSE: Test managed source governance.",
            "// SCOPE: Temporary fixture.",
            "// DEPENDS: M-TMP",
            "// LINKS: docs/modules/M-TMP.xml",
            "// ROLE: RUNTIME",
            "// MAP_MODE: EXPORTS",
            sourceCommentMarkup("END_MODULE_CONTRACT"),
          ].join("\n")
        : "",
      includeMap
        ? [
            sourceCommentMarkup("MODULE_MAP"),
            "// Exports: managed",
            sourceCommentMarkup("END_MODULE_MAP"),
          ].join("\n")
        : "",
      includeChangeSummary
        ? [
            sourceCommentMarkup("CHANGE_SUMMARY"),
            "// Initial governance fixture.",
            sourceCommentMarkup("END_CHANGE_SUMMARY"),
          ].join("\n")
        : "",
      options.body ?? "export const managed = true;",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  function releaseMarkup(path: string, options: MarkupOptions = {}): string {
    const includeContract = options.includeContract ?? true;
    const includeMap = options.includeMap ?? true;
    const includeChangeSummary = options.includeChangeSummary ?? true;
    return [
      includeContract
        ? [
            "<!-- === MODULE_CONTRACT ===",
            `FILE: ${path}`,
            "VERSION: 1.0.0",
            "PURPOSE: Test managed release governance.",
            "SCOPE: Temporary fixture.",
            "DEPENDS: M-TMP",
            "LINKS: docs/modules/M-TMP.xml",
            "ROLE: RELEASE",
            "MAP_MODE: DOCUMENT",
            "=== END_MODULE_CONTRACT === -->",
          ].join("\n")
        : "",
      includeMap
        ? ["<!-- === MODULE_MAP ===", "Sections: Commands", "=== END_MODULE_MAP === -->"].join("\n")
        : "",
      includeChangeSummary
        ? [
            "<!-- === CHANGE_SUMMARY ===",
            "Initial governance fixture.",
            "=== END_CHANGE_SUMMARY === -->",
          ].join("\n")
        : "",
      "# Release\n\n## Commands\n\n- Run verification.",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  function writeProjectFile(root: string, path: string, content: string): void {
    const absolutePath = join(root, path);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  }

  function sourceCommentMarkup(marker: string): string {
    return ["//", "===", marker, "==="].join(" ");
  }
});
