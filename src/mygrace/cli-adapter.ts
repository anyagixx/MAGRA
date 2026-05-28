// === MODULE_CONTRACT ===
// FILE: src/mygrace/cli-adapter.ts
// VERSION: 1.0.0
// PURPOSE: Provide Node-native MyGRACE CLI-equivalent operations for MAGRA runtime.
// SCOPE: Module, phase, verification, lint, and file-markup rendering helpers.
// DEPENDS: M-MYGRACE-DOCS
// LINKS: docs/modules/M-MYGRACE-CLI-ADAPTER.xml
// ROLE: RUNTIME
// MAP_MODE: EXPORTS
// START_MODULE_CONTRACT
// END_MODULE_CONTRACT
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Exports: mygraceModuleIndex, mygraceModuleFind, mygraceModuleList, mygraceModuleShow, mygracePhaseIndex, mygracePhaseShow, mygraceVerificationIndex, mygraceFileShow, mygraceLint, renderMyGraceLintReport
// Locals: renderModuleTable, renderSection, extractMyGraceSection, semanticBlockSummary
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial Node-compatible MyGRACE CLI adapter for MAGRA runtime integration.
// === END_CHANGE_SUMMARY ===

import { existsSync, readFileSync } from "node:fs";
import {
  type LintReport,
  type MyGraceIndexEntry,
  lintMyGraceArtifacts,
  loadGraphIndex,
  loadModule,
  loadPhase,
  loadPlanIndex,
  loadVerification,
  loadVerificationIndex,
  resolveMyGracePath,
} from "./docs.js";

export interface MyGraceListOptions {
  status?: string;
  type?: string;
  format?: "text" | "json";
}

export interface MyGraceModuleShowOptions {
  withVerification?: boolean;
}

export interface MyGraceFileShowOptions {
  contracts?: boolean;
  blocks?: boolean;
}

// === START_CONTRACT: mygraceModuleIndex ===
// PURPOSE: Render docs/graph-index.xml.
// INPUTS: root: string - project root or child path
// OUTPUTS: string
// SIDE_EFFECTS: reads files
// === END_CONTRACT: mygraceModuleIndex ===
export function mygraceModuleIndex(root: string): string {
  // === START_BLOCK_READ_INDEX ===
  return loadGraphIndex(root).raw;
  // === END_BLOCK_READ_INDEX ===
}

export function mygraceModuleFind(
  root: string,
  query = "",
  options: MyGraceListOptions = {},
): string {
  const normalized = query.trim().toLowerCase();
  const entries = filterEntries(loadGraphIndex(root).entries, normalized, options);
  if (options.format === "json")
    return JSON.stringify(
      entries.map((entry) => entry.attrs),
      null,
      2,
    );
  if (entries.length === 0) return "No modules found.";
  return [`Found ${entries.length} module(s):`, "", renderModuleTable(entries)].join("\n");
}

export function mygraceModuleList(root: string, options: MyGraceListOptions = {}): string {
  const entries = filterEntries(loadGraphIndex(root).entries, "", options);
  if (options.format === "json")
    return JSON.stringify(
      entries.map((entry) => entry.attrs),
      null,
      2,
    );
  return [`Modules (${entries.length}):`, "", renderModuleTable(entries)].join("\n");
}

// === START_CONTRACT: mygraceModuleShow ===
// PURPOSE: Render one per-module XML file and optional verification file.
// INPUTS: root: string; id: string; options?: MyGraceModuleShowOptions
// OUTPUTS: string
// SIDE_EFFECTS: reads files
// === END_CONTRACT: mygraceModuleShow ===
export function mygraceModuleShow(
  root: string,
  id: string,
  options: MyGraceModuleShowOptions = {},
): string {
  // === START_BLOCK_READ_ENTITY ===
  const module = loadModule(root, id);
  const sections = [`=== ${id} ===`, "", module.content];
  if (options.withVerification && module.verificationRef) {
    try {
      const verification = loadVerification(root, module.verificationRef);
      sections.push("", `=== ${module.verificationRef} ===`, "", verification.content);
    } catch {
      sections.push("", `=== ${module.verificationRef} ===`, "", "(Verification file not found)");
    }
  }
  return sections.join("\n");
  // === END_BLOCK_READ_ENTITY ===
}

export function mygracePhaseIndex(root: string): string {
  return loadPlanIndex(root).raw;
}

export function mygracePhaseShow(root: string, phase: string): string {
  const entity = loadPhase(root, phase);
  return [`=== ${phase} ===`, "", entity.content].join("\n");
}

export function mygraceVerificationIndex(root: string): string {
  return loadVerificationIndex(root).raw;
}

// === START_CONTRACT: mygraceFileShow ===
// PURPOSE: Render file-local MyGRACE contracts, maps, summaries, and semantic block counts.
// INPUTS: root: string; path: string; options?: MyGraceFileShowOptions
// OUTPUTS: string
// SIDE_EFFECTS: reads files
// === END_CONTRACT: mygraceFileShow ===
export function mygraceFileShow(
  root: string,
  path: string,
  options: MyGraceFileShowOptions = {},
): string {
  // === START_BLOCK_READ_FILE_MARKUP ===
  const target = resolveMyGracePath(root, path);
  if (!existsSync(target)) throw new Error(`File not found: ${path}`);
  const content = readFileSync(target, "utf8");
  const sections: string[] = [];
  for (const name of ["MODULE_CONTRACT", "MODULE_MAP", "CHANGE_SUMMARY"]) {
    const body = extractMyGraceSection(content, name);
    if (body) sections.push(renderSection(name, body));
  }
  // === END_BLOCK_READ_FILE_MARKUP ===

  // === START_BLOCK_RENDER_FILE_MARKUP ===
  if (options.contracts) {
    const contracts = [...content.matchAll(contractRegex())].map((match) => match[0]);
    if (contracts.length > 0) {
      sections.push(renderSection(`CONTRACTS (${contracts.length})`, contracts.join("\n\n")));
    }
  }
  if (options.blocks)
    sections.push(renderSection("SEMANTIC BLOCKS", semanticBlockSummary(content)));
  return sections.length > 0 ? sections.join("\n\n") : "(No MyGRACE file-local markup found)";
  // === END_BLOCK_RENDER_FILE_MARKUP ===
}

// === START_CONTRACT: mygraceLint ===
// PURPOSE: Run MyGRACE artifact lint and return a structured report.
// INPUTS: root: string - project root or child path
// OUTPUTS: LintReport
// SIDE_EFFECTS: reads files
// === END_CONTRACT: mygraceLint ===
export function mygraceLint(root: string): LintReport {
  // === START_BLOCK_RUN_LINT ===
  return lintMyGraceArtifacts(root);
  // === END_BLOCK_RUN_LINT ===
}

export function renderMyGraceLintReport(report: LintReport): string {
  const lines = [
    "MyGRACE Lint Report",
    "===================",
    `Errors:   ${report.errors}`,
    `Warnings: ${report.warnings}`,
    "",
  ];
  const errors = report.issues.filter((issue) => issue.severity === "error");
  const warnings = report.issues.filter((issue) => issue.severity === "warning");
  if (errors.length > 0) {
    lines.push("Errors:");
    for (const issue of errors) lines.push(`  x [${issue.file ?? "project"}] ${issue.message}`);
    lines.push("");
  }
  if (warnings.length > 0) {
    lines.push("Warnings:");
    for (const issue of warnings) lines.push(`  ! [${issue.file ?? "project"}] ${issue.message}`);
    lines.push("");
  }
  if (report.issues.length === 0)
    lines.push("All checks passed. MyGRACE artifacts are consistent.");
  return lines.join("\n");
}

function filterEntries(
  entries: MyGraceIndexEntry[],
  query: string,
  options: MyGraceListOptions,
): MyGraceIndexEntry[] {
  return entries.filter((entry) => {
    const searchable = [entry.id, ...Object.values(entry.attrs)].join(" ").toLowerCase();
    return (
      (!query || searchable.includes(query)) &&
      (!options.status || entry.attrs.STATUS === options.status) &&
      (!options.type || entry.attrs.TYPE === options.type)
    );
  });
}

function renderModuleTable(entries: MyGraceIndexEntry[]): string {
  const rows = [
    ["ID", "NAME", "TYPE", "STATUS", "PATH"],
    ["-".repeat(16), "-".repeat(20), "-".repeat(16), "-".repeat(12), "-".repeat(32)],
    ...entries.map((entry) => [
      entry.id,
      entry.attrs.NAME ?? "",
      entry.attrs.TYPE ?? "",
      entry.attrs.STATUS ?? "",
      entry.attrs.PATH ?? "",
    ]),
  ];
  return rows
    .map((row) => row.map((cell, index) => cell.padEnd([16, 20, 16, 12, 32][index] ?? 12)).join(""))
    .join("\n");
}

function renderSection(title: string, body: string): string {
  return [`=== ${title} ===`, "", body.trim()].join("\n");
}

function extractMyGraceSection(content: string, name: string): string | undefined {
  const marker = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `(^\\s*(?:\\/\\/|#|--)?\\s*===\\s*${marker}\\s*===[\\s\\S]*?^\\s*(?:\\/\\/|#|--)?\\s*===\\s*END_${marker}\\s*===)`,
    "m",
  );
  return content.match(regex)?.[1];
}

function contractRegex(): RegExp {
  return /^\s*(?:\/\/|#|--)?\s*===\s*START_CONTRACT:\s*([\w$.-]+)\s*===[\s\S]*?^\s*(?:\/\/|#|--)?\s*===\s*END_CONTRACT:\s*\1\s*===/gm;
}

function semanticBlockSummary(content: string): string {
  const starts = [...content.matchAll(/START_BLOCK_([A-Z0-9_]+)/g)]
    .map((match) => match[1])
    .filter((name): name is string => Boolean(name));
  const ends = [...content.matchAll(/END_BLOCK_([A-Z0-9_]+)/g)]
    .map((match) => match[1])
    .filter((name): name is string => Boolean(name));
  const missingEnd = starts.filter((name) => !ends.includes(name));
  const missingStart = ends.filter((name) => !starts.includes(name));
  return [
    `START blocks: ${starts.length}`,
    `END blocks:   ${ends.length}`,
    `Status: ${starts.length === ends.length ? "Paired" : "UNPAIRED"}`,
    missingEnd.length > 0 ? `Missing END blocks: ${missingEnd.join(", ")}` : "",
    missingStart.length > 0 ? `Missing START blocks: ${missingStart.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
