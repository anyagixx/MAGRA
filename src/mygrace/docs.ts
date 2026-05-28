// === MODULE_CONTRACT ===
// FILE: src/mygrace/docs.ts
// VERSION: 1.0.0
// PURPOSE: Read, validate, and update index-first MyGRACE artifacts and managed-file governance for MAGRA.
// SCOPE: Graph, plan, verification, per-entity XML helpers, managed-file discovery, and semantic markup linting.
// DEPENDS: M-REASONIX-BASE
// LINKS: docs/modules/M-MYGRACE-DOCS.xml,docs/modules/M-MYGRACE-GOVERNANCE-LINT.xml
// ROLE: RUNTIME
// MAP_MODE: EXPORTS
// START_MODULE_CONTRACT
// END_MODULE_CONTRACT
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Exports: findMyGraceProjectRoot, loadGraphIndex, loadPlanIndex, loadVerificationIndex, loadModule, loadPhase, loadVerification, discoverManagedFiles, lintManagedFileMarkup, lintMyGraceArtifacts, writeModuleDelta
// Locals: loadIndex, parseIndexEntries, parseXmlAttributes, lintIndexSync, lintVerificationRefs, addManagedFile, parseSemanticBlockTokens, lintMarkup, lintXmlTags
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial MAGRA MyGRACE artifact reader, linter, and module delta writer.
// Added graph-index managed file discovery and exact semantic block governance linting.
// === END_CHANGE_SUMMARY ===

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export type MyGraceIndexKind = "graph" | "plan" | "verification";
export type MyGraceLintSeverity = "error" | "warning";

export interface MyGraceIndexEntry {
  id: string;
  attrs: Record<string, string>;
  raw: string;
}

export interface MyGraceIndex {
  kind: MyGraceIndexKind;
  root: string;
  path: string;
  rootTag: string;
  rootAttrs: Record<string, string>;
  entries: MyGraceIndexEntry[];
  raw: string;
}

export type GraphIndex = MyGraceIndex & { kind: "graph" };
export type PlanIndex = MyGraceIndex & { kind: "plan" };
export type VerificationIndex = MyGraceIndex & { kind: "verification" };

export interface MyGraceEntity {
  id: string;
  root: string;
  path: string;
  attrs: Record<string, string>;
  content: string;
  indexEntry?: MyGraceIndexEntry;
}

export interface ModuleContract extends MyGraceEntity {
  verificationRef?: string;
  sourcePath?: string;
  testPath?: string;
}

export type PhaseContract = MyGraceEntity;
export type VerificationContract = MyGraceEntity;

export interface ModuleDelta {
  moduleId: string;
  name?: string;
  type?: string;
  status?: string;
  path?: string;
  depends?: string;
  verificationRef?: string;
}

export interface WriteResult {
  changedFiles: string[];
  moduleId: string;
}

export interface LintIssue {
  severity: MyGraceLintSeverity;
  message: string;
  file?: string;
}

export interface LintReport {
  root: string;
  errors: number;
  warnings: number;
  issues: LintIssue[];
}

export type ManagedFileRole = "source" | "dashboard" | "release" | "documentation";

export interface ManagedFile {
  path: string;
  absolutePath: string;
  role: ManagedFileRole;
  source: string;
  requireContract: boolean;
  requireMap: boolean;
  requireChangeSummary: boolean;
}

interface IndexSpec {
  kind: MyGraceIndexKind;
  file: string;
  entityDir: string;
  tagPattern: string;
  filePrefix: string;
}

const INDEX_SPECS: Record<MyGraceIndexKind, IndexSpec> = {
  graph: {
    kind: "graph",
    file: "graph-index.xml",
    entityDir: "modules",
    tagPattern: "M-[\\w-]+",
    filePrefix: "M-",
  },
  plan: {
    kind: "plan",
    file: "plan-index.xml",
    entityDir: "plans",
    tagPattern: "Phase-\\d+",
    filePrefix: "Phase-",
  },
  verification: {
    kind: "verification",
    file: "verification-index.xml",
    entityDir: "verification",
    tagPattern: "V-M-[\\w-]+",
    filePrefix: "V-M-",
  },
};

const MONOLITHIC_FILES = ["knowledge-graph.xml", "development-plan.xml", "verification-plan.xml"];
const APPROVED_MANAGED_DOC_DIRS: Array<{ dir: string; role: ManagedFileRole }> = [
  { dir: "docs/release", role: "release" },
];
const REQUIRED_MARKERS = ["MODULE_CONTRACT", "MODULE_MAP", "CHANGE_SUMMARY"] as const;

// === START_CONTRACT: findMyGraceProjectRoot ===
// PURPOSE: Resolve the nearest parent directory containing docs/graph-index.xml.
// INPUTS: startDir: string - starting directory
// OUTPUTS: string
// SIDE_EFFECTS: none
// === END_CONTRACT: findMyGraceProjectRoot ===
export function findMyGraceProjectRoot(startDir: string): string {
  // === START_BLOCK_FIND_ROOT ===
  let current = resolve(startDir);
  while (true) {
    if (existsSync(join(current, "docs", "graph-index.xml"))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error("MyGRACE project not found. Expected docs/graph-index.xml.");
  // === END_BLOCK_FIND_ROOT ===
}

// === START_CONTRACT: loadGraphIndex ===
// PURPOSE: Load docs/graph-index.xml and parse module index entries.
// INPUTS: root: string - project root or child path
// OUTPUTS: GraphIndex
// SIDE_EFFECTS: reads files
// === END_CONTRACT: loadGraphIndex ===
export function loadGraphIndex(root: string): GraphIndex {
  // === START_BLOCK_READ_INDEX ===
  return loadIndex(root, "graph") as GraphIndex;
  // === END_BLOCK_READ_INDEX ===
}

export function loadPlanIndex(root: string): PlanIndex {
  return loadIndex(root, "plan") as PlanIndex;
}

export function loadVerificationIndex(root: string): VerificationIndex {
  return loadIndex(root, "verification") as VerificationIndex;
}

// === START_CONTRACT: loadModule ===
// PURPOSE: Load one per-module XML file after resolving it through graph-index.xml.
// INPUTS: root: string - project root; moduleId: string - M-XXX id
// OUTPUTS: ModuleContract
// SIDE_EFFECTS: reads files
// === END_CONTRACT: loadModule ===
export function loadModule(root: string, moduleId: string): ModuleContract {
  // === START_BLOCK_LOAD_MODULE_ENTRY ===
  const graph = loadGraphIndex(root);
  const entry = graph.entries.find((item) => item.id === moduleId);
  const entity = loadEntity(graph.root, "modules", moduleId, entry);
  // === END_BLOCK_LOAD_MODULE_ENTRY ===

  // === START_BLOCK_PARSE_MODULE_LINKS ===
  return {
    ...entity,
    indexEntry: entry,
    verificationRef:
      extractTagText(entity.content, "verification-ref") ?? entry?.attrs.VERIFICATION_REF,
    sourcePath: extractTagText(entity.content, "source-path") ?? entry?.attrs.PATH,
    testPath: extractTagText(entity.content, "test-path"),
  };
  // === END_BLOCK_PARSE_MODULE_LINKS ===
}

export function loadPhase(root: string, phaseId: string): PhaseContract {
  const plan = loadPlanIndex(root);
  const entry = plan.entries.find((item) => item.id === phaseId);
  return loadEntity(plan.root, "plans", phaseId, entry);
}

export function loadVerification(root: string, verificationId: string): VerificationContract {
  const verification = loadVerificationIndex(root);
  const entry = verification.entries.find((item) => item.id === verificationId);
  return loadEntity(verification.root, "verification", verificationId, entry);
}

// === START_CONTRACT: writeModuleDelta ===
// PURPOSE: Apply a bounded module metadata update to graph-index and the per-module root tag.
// INPUTS: root: string - project root; delta: ModuleDelta - module metadata changes
// OUTPUTS: WriteResult
// SIDE_EFFECTS: writes XML files
// === END_CONTRACT: writeModuleDelta ===
export function writeModuleDelta(root: string, delta: ModuleDelta): WriteResult {
  // === START_BLOCK_SYNC_INDEX ===
  const resolvedRoot = findMyGraceProjectRoot(root);
  const graphPath = join(resolvedRoot, "docs", "graph-index.xml");
  const modulePath = join(resolvedRoot, "docs", "modules", `${delta.moduleId}.xml`);
  const changedFiles: string[] = [];

  const indexUpdates: Record<string, string | undefined> = {
    NAME: delta.name,
    TYPE: delta.type,
    STATUS: delta.status,
    PATH: delta.path,
    DEPENDS: delta.depends,
    VERIFICATION_REF: delta.verificationRef,
  };
  const nextIndex = replaceTagAttributes(
    readFileSync(graphPath, "utf8"),
    delta.moduleId,
    indexUpdates,
  );
  writeIfChanged(graphPath, nextIndex, changedFiles, resolvedRoot);
  // === END_BLOCK_SYNC_INDEX ===

  // === START_BLOCK_SYNC_MODULE_FILE ===
  if (existsSync(modulePath)) {
    const moduleUpdates: Record<string, string | undefined> = {
      NAME: delta.name,
      TYPE: delta.type,
      STATUS: delta.status,
    };
    const nextModule = replaceTagAttributes(
      readFileSync(modulePath, "utf8"),
      delta.moduleId,
      moduleUpdates,
    );
    writeIfChanged(modulePath, nextModule, changedFiles, resolvedRoot);
  }
  // === END_BLOCK_SYNC_MODULE_FILE ===

  return { changedFiles, moduleId: delta.moduleId };
}

// === START_CONTRACT: discoverManagedFiles ===
// PURPOSE: Discover existing files governed by graph-index PATH entries and approved docs directories.
// INPUTS: root: string - project root or child path
// OUTPUTS: ManagedFile[]
// SIDE_EFFECTS: reads indexes and directory metadata
// === END_CONTRACT: discoverManagedFiles ===
export function discoverManagedFiles(root: string): ManagedFile[] {
  // === START_BLOCK_DISCOVER_MANAGED_FILES ===
  const resolvedRoot = findMyGraceProjectRoot(root);
  const graph = loadGraphIndex(resolvedRoot);
  const managedByPath = new Map<string, ManagedFile>();

  for (const entry of graph.entries) {
    const entryPath = entry.attrs.PATH;
    if (!entryPath || !isGovernedManagedPath(entryPath)) continue;
    addManagedFile(managedByPath, resolvedRoot, entryPath, {
      role: inferManagedFileRole(entryPath),
      source: `graph-index:${entry.id}`,
    });
  }

  for (const docDir of APPROVED_MANAGED_DOC_DIRS) {
    const absoluteDir = join(resolvedRoot, docDir.dir);
    if (!existsSync(absoluteDir)) continue;
    for (const absolutePath of walkManagedFiles(absoluteDir)) {
      const managedPath = normalizePath(relative(resolvedRoot, absolutePath));
      addManagedFile(managedByPath, resolvedRoot, managedPath, {
        role: docDir.role,
        source: `approved-docs:${docDir.dir}`,
      });
    }
  }

  return Array.from(managedByPath.values()).sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  // === END_BLOCK_DISCOVER_MANAGED_FILES ===
}

// === START_CONTRACT: lintManagedFileMarkup ===
// PURPOSE: Validate required MyGRACE metadata and exact semantic block pairing in one managed file.
// INPUTS: file: ManagedFile - discovered managed file descriptor
// OUTPUTS: LintIssue[]
// SIDE_EFFECTS: reads one file
// === END_CONTRACT: lintManagedFileMarkup ===
export function lintManagedFileMarkup(file: ManagedFile): LintIssue[] {
  // === START_BLOCK_LINT_MANAGED_FILE_MARKUP ===
  const issues: LintIssue[] = [];
  const content = readFileSync(file.absolutePath, "utf8");
  const required: Array<(typeof REQUIRED_MARKERS)[number]> = [];

  if (file.requireContract) required.push("MODULE_CONTRACT");
  if (file.requireMap) required.push("MODULE_MAP");
  if (file.requireChangeSummary) required.push("CHANGE_SUMMARY");

  for (const marker of required) {
    if (!hasMarkupPair(content, marker)) {
      issues.push({
        severity: "error",
        message: `Managed file missing ${marker} markup from ${file.source}`,
        file: file.path,
      });
    }
  }

  issues.push(...lintSemanticBlockPairs(content, file));
  return issues;
  // === END_BLOCK_LINT_MANAGED_FILE_MARKUP ===
}

// === START_CONTRACT: lintMyGraceArtifacts ===
// PURPOSE: Validate MyGRACE index sync, semantic markup, XML conventions, and verification refs.
// INPUTS: root: string - project root or child path
// OUTPUTS: LintReport
// SIDE_EFFECTS: reads files
// === END_CONTRACT: lintMyGraceArtifacts ===
export function lintMyGraceArtifacts(root: string): LintReport {
  // === START_BLOCK_RUN_LINT ===
  const issues: LintIssue[] = [];
  let resolvedRoot = resolve(root);
  try {
    resolvedRoot = findMyGraceProjectRoot(root);
    issues.push(...lintMonolithicFiles(resolvedRoot));
    issues.push(...lintIndexSync(resolvedRoot, INDEX_SPECS.graph));
    issues.push(...lintIndexSync(resolvedRoot, INDEX_SPECS.plan));
    issues.push(...lintIndexSync(resolvedRoot, INDEX_SPECS.verification));
    issues.push(...lintVerificationRefs(resolvedRoot));
    issues.push(...lintMarkup(resolvedRoot));
    issues.push(...lintXmlTags(resolvedRoot));
  } catch (error) {
    issues.push({ severity: "error", message: errorMessage(error) });
  }
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  return { root: resolvedRoot, errors, warnings, issues };
  // === END_BLOCK_RUN_LINT ===
}

function loadIndex(root: string, kind: MyGraceIndexKind): MyGraceIndex {
  const resolvedRoot = findMyGraceProjectRoot(root);
  const spec = INDEX_SPECS[kind];
  const path = join(resolvedRoot, "docs", spec.file);
  if (!existsSync(path)) throw new Error(`Missing docs/${spec.file}`);
  const raw = readFileSync(path, "utf8");
  const rootMatch = raw.match(/<([A-Za-z][\w-]*)([^>]*)>/);
  const rootTag = rootMatch?.[1];
  if (!rootTag) throw new Error(`Could not parse root tag in docs/${spec.file}`);
  return {
    kind,
    root: resolvedRoot,
    path,
    rootTag,
    rootAttrs: parseXmlAttributes(rootMatch?.[2] ?? ""),
    entries: parseIndexEntries(raw, spec.tagPattern),
    raw,
  };
}

function loadEntity(
  root: string,
  entityDir: "modules" | "plans" | "verification",
  id: string,
  indexEntry?: MyGraceIndexEntry,
): MyGraceEntity {
  const path = join(root, "docs", entityDir, `${id}.xml`);
  if (!existsSync(path)) throw new Error(`Missing docs/${entityDir}/${id}.xml`);
  const content = readFileSync(path, "utf8");
  return {
    id,
    root,
    path,
    attrs: parseEntityRootAttrs(content, id),
    content,
    indexEntry,
  };
}

function parseIndexEntries(content: string, tagPattern: string): MyGraceIndexEntry[] {
  const entries: MyGraceIndexEntry[] = [];
  const regex = new RegExp(`<(${tagPattern})([^>]*?)(?:\\/>|>[\\s\\S]*?<\\/\\1>)`, "g");
  let match = regex.exec(content);
  while (match !== null) {
    const id = match[1];
    if (!id) continue;
    entries.push({
      id,
      attrs: parseXmlAttributes(match[2] ?? ""),
      raw: match[0],
    });
    match = regex.exec(content);
  }
  return entries;
}

function parseXmlAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([A-Za-z_:][\w:.-]*)="([^"]*)"/g;
  let match = regex.exec(source);
  while (match !== null) {
    const key = match[1];
    const value = match[2];
    if (key !== undefined && value !== undefined) attrs[key] = value;
    match = regex.exec(source);
  }
  return attrs;
}

function parseEntityRootAttrs(content: string, id: string): Record<string, string> {
  const regex = new RegExp(`<${escapeRegExp(id)}\\b([^>]*)>`);
  const match = content.match(regex);
  if (!match) return {};
  return parseXmlAttributes(match[1] ?? "");
}

function extractTagText(content: string, tag: string): string | undefined {
  const regex = new RegExp(`<${escapeRegExp(tag)}>([\\s\\S]*?)<\\/${escapeRegExp(tag)}>`);
  const match = content.match(regex);
  return match?.[1]?.trim();
}

function lintIndexSync(root: string, spec: IndexSpec): LintIssue[] {
  const issues: LintIssue[] = [];
  const indexPath = join(root, "docs", spec.file);
  const entityPath = join(root, "docs", spec.entityDir);
  if (!existsSync(indexPath)) {
    return [{ severity: "error", message: `Missing docs/${spec.file}`, file: `docs/${spec.file}` }];
  }
  if (!existsSync(entityPath)) {
    return [
      {
        severity: "error",
        message: `Missing docs/${spec.entityDir}/ directory`,
        file: `docs/${spec.entityDir}`,
      },
    ];
  }

  const index = loadIndex(root, spec.kind);
  const files = readdirSync(entityPath).filter(
    (file) => file.startsWith(spec.filePrefix) && file.endsWith(".xml"),
  );
  const fileIds = new Set(files.map((file) => file.replace(/\.xml$/, "")));
  const indexIds = new Set(index.entries.map((entry) => entry.id));

  for (const entry of index.entries) {
    if (!fileIds.has(entry.id)) {
      issues.push({
        severity: "error",
        message: `Orphaned index entry: ${entry.id}`,
        file: `docs/${spec.file}`,
      });
    }
  }
  for (const file of files) {
    const id = file.replace(/\.xml$/, "");
    if (!indexIds.has(id)) {
      issues.push({
        severity: "error",
        message: `Missing index entry: ${id}`,
        file: `docs/${spec.entityDir}/${file}`,
      });
    }
  }
  for (const entry of index.entries) {
    const filePath = join(entityPath, `${entry.id}.xml`);
    if (!existsSync(filePath)) continue;
    const attrs = parseEntityRootAttrs(readFileSync(filePath, "utf8"), entry.id);
    const fileStatus = attrs.STATUS;
    const indexStatus = entry.attrs.STATUS;
    if (fileStatus && indexStatus && fileStatus !== indexStatus) {
      issues.push({
        severity: "warning",
        message: `STATUS drift: ${entry.id} has "${fileStatus}" in file but "${indexStatus}" in index`,
        file: `docs/${spec.file}`,
      });
    }
  }
  return issues;
}

function lintVerificationRefs(root: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const modulesDir = join(root, "docs", "modules");
  if (!existsSync(modulesDir)) return issues;
  for (const file of readdirSync(modulesDir).filter((item) => item.startsWith("M-"))) {
    const content = readFileSync(join(modulesDir, file), "utf8");
    const verificationRef = extractTagText(content, "verification-ref");
    if (!verificationRef) continue;
    const verificationPath = join(root, "docs", "verification", `${verificationRef}.xml`);
    if (!existsSync(verificationPath)) {
      issues.push({
        severity: "error",
        message: `Verification ref ${verificationRef} points to a missing file`,
        file: `docs/modules/${file}`,
      });
    }
  }
  return issues;
}

function lintMarkup(root: string): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const file of discoverManagedFiles(root)) {
    issues.push(...lintManagedFileMarkup(file));
  }
  return issues;
}

function lintXmlTags(root: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const genericTags = [
    { pattern: "<Module ", fix: "M-XXX" },
    { pattern: "<Phase ", fix: "Phase-N" },
    { pattern: "<Verification ", fix: "V-M-XXX" },
    { pattern: "<step ", fix: "step-N" },
  ];
  for (const dir of ["docs", "docs/modules", "docs/plans", "docs/verification"]) {
    const full = join(root, dir);
    if (!existsSync(full)) continue;
    for (const file of readdirSync(full).filter((item) => item.endsWith(".xml"))) {
      const content = readFileSync(join(full, file), "utf8");
      for (const tag of genericTags) {
        if (content.includes(tag.pattern)) {
          issues.push({
            severity: "warning",
            message: `Generic XML tag detected: "${tag.pattern.trim()}"; use ${tag.fix}`,
            file: `${dir}/${file}`,
          });
        }
      }
    }
  }
  return issues;
}

function lintMonolithicFiles(root: string): LintIssue[] {
  return MONOLITHIC_FILES.flatMap((file) => {
    const path = join(root, "docs", file);
    return existsSync(path)
      ? [
          {
            severity: "error" as const,
            message: `Monolithic MyGRACE file is not allowed: ${file}`,
            file: `docs/${file}`,
          },
        ]
      : [];
  });
}

function walkManagedFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!["node_modules", "dist", ".git"].includes(entry.name)) stack.push(full);
        continue;
      }
      if (isGovernedManagedPath(full)) out.push(full);
    }
  }
  return out;
}

function addManagedFile(
  managedByPath: Map<string, ManagedFile>,
  root: string,
  filePath: string,
  metadata: { role: ManagedFileRole; source: string },
): void {
  const absolutePath = isAbsolute(filePath) ? resolve(filePath) : resolve(root, filePath);
  if (!existsSync(absolutePath) || statSync(absolutePath).isDirectory()) return;
  const path = normalizePath(relative(root, absolutePath));
  if (path.startsWith("..") || isAbsolute(path)) return;
  const existing = managedByPath.get(path);
  if (existing) {
    const sources = new Set(existing.source.split(",").map((source) => source.trim()));
    sources.add(metadata.source);
    existing.source = Array.from(sources).join(",");
    if (existing.role !== metadata.role && metadata.role === "release") existing.role = "release";
    return;
  }
  managedByPath.set(path, {
    path,
    absolutePath,
    role: metadata.role,
    source: metadata.source,
    requireContract: true,
    requireMap: true,
    requireChangeSummary: true,
  });
}

function inferManagedFileRole(path: string): ManagedFileRole {
  const normalized = normalizePath(path);
  if (normalized.startsWith("dashboard/")) return "dashboard";
  if (normalized.startsWith("docs/release/") || normalized === "README.md") return "release";
  if (normalized.startsWith("docs/")) return "documentation";
  return "source";
}

function isGovernedManagedPath(path: string): boolean {
  return /\.(?:ts|tsx|js|jsx|mjs|cjs|mts|cts|md|mdx)$/i.test(path);
}

function hasMarkupPair(content: string, marker: (typeof REQUIRED_MARKERS)[number]): boolean {
  const start = new RegExp(`(?:^|\\n)\\s*(?://|<!--)?\\s*===\\s*${marker}\\s*===`);
  const end = new RegExp(`(?:^|\\n)\\s*(?://|<!--)?\\s*===\\s*END_${marker}\\s*===`);
  return start.test(content) && end.test(content);
}

interface SemanticBlockToken {
  kind: "START" | "END";
  name: string;
  line: number;
}

function lintSemanticBlockPairs(content: string, file: ManagedFile): LintIssue[] {
  const issues: LintIssue[] = [];
  const stack: SemanticBlockToken[] = [];
  for (const token of parseSemanticBlockTokens(content)) {
    if (token.kind === "START") {
      stack.push(token);
      continue;
    }

    const open = stack.pop();
    if (!open) {
      issues.push({
        severity: "error",
        message: `Orphan semantic block END_BLOCK_${token.name} at line ${token.line} from ${file.source}`,
        file: file.path,
      });
      continue;
    }

    if (open.name !== token.name) {
      issues.push({
        severity: "error",
        message: `Mismatched semantic block START_BLOCK_${open.name} at line ${open.line} closed by END_BLOCK_${token.name} at line ${token.line} from ${file.source}`,
        file: file.path,
      });
    }
  }

  for (const open of stack) {
    issues.push({
      severity: "error",
      message: `Unclosed semantic block START_BLOCK_${open.name} at line ${open.line} from ${file.source}`,
      file: file.path,
    });
  }
  return issues;
}

function parseSemanticBlockTokens(content: string): SemanticBlockToken[] {
  const tokens: SemanticBlockToken[] = [];
  const regex =
    /^\s*(?:(?:\/\/|#|<!--)\s*)?===\s*(START|END)_BLOCK_([A-Za-z0-9][A-Za-z0-9_-]*)\s*===/gm;
  let match = regex.exec(content);
  while (match !== null) {
    const kind = match[1];
    const name = match[2];
    if ((kind === "START" || kind === "END") && name) {
      tokens.push({ kind, name, line: lineNumberAt(content, match.index) });
    }
    match = regex.exec(content);
  }
  return tokens;
}

function lineNumberAt(content: string, index: number): number {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (content.charCodeAt(cursor) === 10) line += 1;
  }
  return line;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function replaceTagAttributes(
  content: string,
  tagName: string,
  updates: Record<string, string | undefined>,
): string {
  const regex = new RegExp(`<${escapeRegExp(tagName)}\\b([^>]*?)(\\/?)>`);
  const next = content.replace(regex, (raw, attrSource: string, slash: string) => {
    const attrs = parseXmlAttributes(attrSource);
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) attrs[key] = value;
    }
    const serialized = Object.entries(attrs)
      .map(([key, value]) => `${key}="${escapeXmlAttr(value)}"`)
      .join(" ");
    return `<${tagName}${serialized ? ` ${serialized}` : ""}${slash}>`;
  });
  if (next === content && !new RegExp(`<${escapeRegExp(tagName)}\\b`).test(content)) {
    throw new Error(`Could not find XML tag ${tagName}`);
  }
  return next;
}

function writeIfChanged(path: string, content: string, changedFiles: string[], root: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const previous = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (previous === content) return;
  writeFileSync(path, content);
  changedFiles.push(relative(root, path));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeXmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function resolveMyGracePath(root: string, filePath: string): string {
  const projectRoot = findMyGraceProjectRoot(root);
  return isAbsolute(filePath) ? filePath : join(projectRoot, filePath);
}
