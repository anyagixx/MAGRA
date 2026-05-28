// === MODULE_CONTRACT ===
// FILE: src/snarc/memory.ts
// VERSION: 1.0.0
// PURPOSE: Store and retrieve project-scoped salience-gated SNARC memory for MAGRA sessions.
// SCOPE: SQLite persistence, heuristic SNARC scoring, redaction, search, briefing, stats, consolidation, and legacy JSON import routing.
// DEPENDS: M-SNARC-SQLITE-STORE,M-REASONIX-BASE
// LINKS: docs/modules/M-SNARC-MEMORY.xml
// ROLE: DATA_LAYER
// MAP_MODE: EXPORTS
// START_MODULE_CONTRACT
// END_MODULE_CONTRACT
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Exports: captureObservation, searchMemory, getSessionBriefing, runConsolidation, readSnarcStats, listSnarcPatterns, listSnarcIdentityFacts, resolveSnarcMemoryPath, resolveLegacySnarcMemoryPath, redactSnarcText
// Locals: readStore, writeStoreAtomic, scoreObservation, summarize, extractTokens, extractTags, upsertPattern
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Routed MAGRA SNARC memory through SQLite persistence while preserving provenance-labeled retrieval.
// === END_CHANGE_SUMMARY ===

import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { resolve } from "node:path";
import {
  querySnarcRows,
  readSnarcStoreSnapshot,
  resolveSnarcLegacyJsonPath,
  resolveSnarcSqlitePath,
  writeSnarcStoreSnapshot,
} from "./sqlite-store.js";

export type SnarcProvenance = "observed" | "inferred" | "identity";

export interface SnarcScores {
  surprise: number;
  novelty: number;
  arousal: number;
  reward: number;
  conflict: number;
  salience: number;
}

export interface CaptureObservationInput {
  rootDir?: string;
  sessionId?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  text?: unknown;
  cwd?: string;
  exitCode?: number;
  timestamp?: string;
  threshold?: number;
  provenance?: SnarcProvenance;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CaptureResult {
  captured: boolean;
  score: SnarcScores;
  reason: string;
  logMarker: string;
  observation?: SnarcObservation;
  path?: string;
}

export interface SearchMemoryOptions {
  rootDir?: string;
  limit?: number;
  minConfidence?: number;
  provenance?: SnarcProvenance[];
}

export interface SnarcObservation {
  id: string;
  sessionId: string;
  ts: string;
  toolName: string;
  inputSummary: string;
  outputSummary: string;
  cwd: string;
  provenance: "observed";
  tags: string[];
  scores: SnarcScores;
  salience: number;
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface SnarcPattern {
  id: string;
  kind: string;
  summary: string;
  detail: string;
  frequency: number;
  sourceIds: string[];
  confidence: number;
  lastSeen: string;
  provenance: "inferred";
  tags: string[];
}

export interface SnarcIdentityFact {
  id: string;
  key: string;
  value: string;
  source: string;
  confidence: number;
  createdAt: string;
  provenance: "identity";
}

export interface SnarcSearchResult {
  id: string;
  tier: 1 | 2 | 3;
  summary: string;
  provenance: SnarcProvenance;
  confidence: number;
  salience?: number;
  score: number;
  ts?: string;
  sessionId?: string;
  kind?: string;
  tags: string[];
}

export interface SessionBriefingOptions {
  rootDir?: string;
  maxChars?: number;
  query?: string;
}

export interface ConsolidationOptions {
  rootDir?: string;
  now?: string;
}

export interface ConsolidationResult {
  patternsCreated: number;
  patternsDecayed: number;
  patternsPruned: number;
  observationsProcessed: number;
  logMarker: string;
}

export interface SnarcStats {
  path: string;
  available: boolean;
  observations: number;
  patterns: number;
  identityFacts: number;
  seenTokens: number;
  sessions: number;
  avgSalience: number | null;
  lastObservation: string | null;
  totalBytes: number;
  detail: string;
}

export interface SeenToken {
  firstSeen: string;
  count: number;
}

export interface SnarcSession {
  sessionId: string;
  startedAt: string;
  endedAt?: string;
  cwd: string;
  obsCount: number;
}

export interface SnarcStore {
  version: 1;
  projectRoot: string;
  observations: SnarcObservation[];
  patterns: SnarcPattern[];
  identity: SnarcIdentityFact[];
  seenTokens: Record<string, SeenToken>;
  transitions: Record<string, number>;
  sessions: Record<string, SnarcSession>;
}

export type StoreRead =
  | { ok: true; store: SnarcStore; path: string }
  | { ok: false; path: string; error: string };

const LOG_MARKERS = Object.freeze({
  score: "[SnarcMemory][captureObservation][BLOCK_SCORE_SALIENCE]",
  query: "[SnarcMemory][searchMemory][BLOCK_QUERY_MEMORY]",
  briefing: "[SnarcMemory][getSessionBriefing][BLOCK_BUILD_BRIEFING]",
  consolidate: "[SnarcMemory][runConsolidation][BLOCK_CONSOLIDATE_PATTERNS]",
});

const WEIGHTS = Object.freeze({
  surprise: 0.2,
  novelty: 0.25,
  arousal: 0.25,
  reward: 0.2,
  conflict: 0.1,
});

const DEFAULT_THRESHOLD = 0.1;
const MAX_OBSERVATIONS = 1000;
const MAX_PATTERNS = 300;
const MAX_SUMMARY_CHARS = 400;
const TOKEN_LIMIT = 30;
const ERROR_PATTERNS = /\b(error|fail|failed|panic|exception|fatal|denied|rejected)\b/i;
const WARNING_PATTERNS = /\b(warn|warning|deprecated|timeout|retry)\b/i;
const SUCCESS_PATTERNS = /\b(pass|passed|success|succeeded|ok|completed|fixed|resolved)\b/i;
const STATE_CHANGE_PATTERNS =
  /\b(created|deleted|modified|renamed|moved|installed|removed|updated|wrote|saved|committed)\b/i;

// === START_CONTRACT: resolveSnarcMemoryPath ===
// PURPOSE: Resolve the local project-scoped SNARC memory file path.
// INPUTS: rootDir?: string - project root or current working directory fallback
// OUTPUTS: string
// SIDE_EFFECTS: none
// === END_CONTRACT: resolveSnarcMemoryPath ===
export function resolveSnarcMemoryPath(rootDir = process.cwd()): string {
  // === START_BLOCK_RESOLVE_PATH ===
  return resolveSnarcSqlitePath(rootDir);
  // === END_BLOCK_RESOLVE_PATH ===
}

// === START_CONTRACT: resolveLegacySnarcMemoryPath ===
// PURPOSE: Resolve the old JSON SNARC memory path used for one-time imports.
// INPUTS: rootDir?: string - project root or current working directory fallback
// OUTPUTS: string
// SIDE_EFFECTS: none
// === END_CONTRACT: resolveLegacySnarcMemoryPath ===
export function resolveLegacySnarcMemoryPath(rootDir = process.cwd()): string {
  // === START_BLOCK_RESOLVE_LEGACY_PATH ===
  return resolveSnarcLegacyJsonPath(rootDir);
  // === END_BLOCK_RESOLVE_LEGACY_PATH ===
}

// === START_CONTRACT: redactSnarcText ===
// PURPOSE: Remove common secret-bearing fragments before text is persisted into SNARC memory.
// INPUTS: text: string - raw prompt, tool args, or tool result text
// OUTPUTS: string
// SIDE_EFFECTS: none
// === END_CONTRACT: redactSnarcText ===
export function redactSnarcText(text: string): string {
  // === START_BLOCK_REDACT_TEXT ===
  return stripAnsiText(text)
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+/=-]{12,}/gi, "$1 [REDACTED]")
    .replace(/\b(sk-[A-Za-z0-9_-]{12,})\b/g, "[REDACTED_API_KEY]")
    .replace(/\b(gh[pousr]_[A-Za-z0-9_]{20,})\b/g, "[REDACTED_GITHUB_TOKEN]")
    .replace(/\b(AKIA[0-9A-Z]{16})\b/g, "[REDACTED_AWS_KEY]")
    .replace(
      /\b(api[_-]?key|apikey|token|password|passwd|secret|client_secret)\b\s*[:=]\s*["']?[^"'\s,;]{6,}/gi,
      "$1=[REDACTED]",
    )
    .replace(/\b[a-f0-9]{32,}\b/gi, "[REDACTED_HEX]");
  // === END_BLOCK_REDACT_TEXT ===
}

function stripAnsiText(value: string): string {
  let output = "";
  for (let index = 0; index < value.length; index++) {
    if (value.charCodeAt(index) === 27 && value[index + 1] === "[") {
      const end = value.indexOf("m", index + 2);
      if (end > index && /^[0-9;]*$/.test(value.slice(index + 2, end))) {
        index = end;
        continue;
      }
    }
    output += value.charAt(index);
  }
  return output;
}

// === START_CONTRACT: captureObservation ===
// PURPOSE: Score a prompt/tool/conversation observation and persist it when salience passes the SNARC gate.
// INPUTS: input: CaptureObservationInput - observation payload with project root, session, text, tool, and provenance data
// OUTPUTS: CaptureResult
// SIDE_EFFECTS: reads and transactionally writes .magra/snarc/memory.sqlite when capture succeeds
// === END_CONTRACT: captureObservation ===
export function captureObservation(input: CaptureObservationInput): CaptureResult {
  // === START_BLOCK_SCORE_SALIENCE ===
  const rootDir = input.rootDir ?? process.cwd();
  const read = readStore(rootDir);
  const emptyScore = emptyScores();
  if (!read.ok) {
    return {
      captured: false,
      score: emptyScore,
      reason: `memory-load-failed: ${read.error}`,
      logMarker: LOG_MARKERS.score,
      path: read.path,
    };
  }

  const now = input.timestamp ?? new Date().toISOString();
  const toolName = summarize(toText(input.toolName ?? "conversation"), 80);
  const inputSummary = summarize(
    redactSnarcText(toText(input.input ?? input.text ?? "")),
    MAX_SUMMARY_CHARS,
  );
  const outputSummary = summarize(redactSnarcText(toText(input.output ?? "")), MAX_SUMMARY_CHARS);
  const mergedText = [toolName, inputSummary, outputSummary].filter(Boolean).join(" ");
  const tokens = extractTokens(mergedText);
  const scores = scoreObservation(read.store, {
    toolName,
    inputSummary,
    outputSummary,
    cwd: input.cwd ?? rootDir,
    exitCode: input.exitCode,
    tokens,
    now,
  });

  for (const token of tokens) {
    const existing = read.store.seenTokens[token];
    read.store.seenTokens[token] = existing
      ? { ...existing, count: existing.count + 1 }
      : { firstSeen: now, count: 1 };
  }

  const threshold = clamp(input.threshold ?? DEFAULT_THRESHOLD);
  if (!mergedText.trim()) {
    return {
      captured: false,
      score: scores,
      reason: "empty-observation",
      logMarker: LOG_MARKERS.score,
    };
  }
  if (scores.salience < threshold) {
    return {
      captured: false,
      score: scores,
      reason: "below-salience-threshold",
      logMarker: LOG_MARKERS.score,
      path: read.path,
    };
  }

  const sessionId = summarize(toText(input.sessionId ?? "default"), 120);
  const observation: SnarcObservation = {
    id: randomUUID(),
    sessionId,
    ts: now,
    toolName,
    inputSummary,
    outputSummary,
    cwd: input.cwd ?? rootDir,
    provenance: "observed",
    tags: [
      ...new Set([...(input.tags ?? []), ...extractTags(toolName, inputSummary, outputSummary)]),
    ],
    scores,
    salience: scores.salience,
    confidence: Math.max(0.4, Math.min(0.95, 0.45 + scores.salience * 0.5)),
    metadata: sanitizeMetadata(input.metadata),
  };

  read.store.observations.push(observation);
  read.store.observations = read.store.observations
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, MAX_OBSERVATIONS);
  const session = read.store.sessions[sessionId] ?? {
    sessionId,
    startedAt: now,
    cwd: input.cwd ?? rootDir,
    obsCount: 0,
  };
  read.store.sessions[sessionId] = {
    ...session,
    cwd: input.cwd ?? session.cwd,
    obsCount: session.obsCount + 1,
  };

  const write = writeStoreAtomic(read.path, read.store);
  if (!write.ok) {
    return {
      captured: false,
      score: scores,
      reason: `memory-write-failed: ${write.error}`,
      logMarker: LOG_MARKERS.score,
      observation,
      path: read.path,
    };
  }

  return {
    captured: true,
    score: scores,
    reason: "captured",
    logMarker: LOG_MARKERS.score,
    observation,
    path: read.path,
  };
  // === END_BLOCK_SCORE_SALIENCE ===
}

// === START_CONTRACT: searchMemory ===
// PURPOSE: Search observations, inferred patterns, and identity facts with provenance-labeled ranking.
// INPUTS: query: string; options?: SearchMemoryOptions
// OUTPUTS: SnarcSearchResult[]
// SIDE_EFFECTS: reads .magra/snarc/memory.sqlite
// === END_CONTRACT: searchMemory ===
export function searchMemory(
  query: string,
  options: SearchMemoryOptions = {},
): SnarcSearchResult[] {
  // === START_BLOCK_QUERY_MEMORY ===
  return querySnarcRows(query, options);
  // === END_BLOCK_QUERY_MEMORY ===
}

// === START_CONTRACT: getSessionBriefing ===
// PURPOSE: Build conservative provenance-labeled memory context for injection into the next MAGRA turn.
// INPUTS: rootDir?: string; options?: SessionBriefingOptions
// OUTPUTS: string
// SIDE_EFFECTS: reads .magra/snarc/memory.sqlite
// === END_CONTRACT: getSessionBriefing ===
export function getSessionBriefing(
  rootDir = process.cwd(),
  options: SessionBriefingOptions = {},
): string {
  // === START_BLOCK_BUILD_BRIEFING ===
  const read = readStore(options.rootDir ?? rootDir);
  if (!read.ok) return "";
  const maxChars = Math.max(200, Math.min(options.maxChars ?? 2000, 8000));
  const lines: string[] = [];

  const patterns = read.store.patterns
    .filter((pattern) => pattern.confidence >= 0.6 && pattern.kind !== "proposed_identity")
    .sort((a, b) => b.confidence - a.confidence || b.frequency - a.frequency)
    .slice(0, 3);
  if (patterns.length > 0) {
    lines.push("SNARC inferred patterns, verify before relying on them:");
    for (const pattern of patterns) {
      lines.push(
        `- [inferred:${pattern.kind}] ${pattern.summary} (confidence ${pattern.confidence.toFixed(2)})`,
      );
    }
  }

  const observations = read.store.observations
    .filter((observation) => observation.salience >= 0.3)
    .sort((a, b) => b.salience - a.salience || b.ts.localeCompare(a.ts))
    .slice(0, 3);
  if (observations.length > 0) {
    lines.push("SNARC observed recent context:");
    for (const observation of observations) {
      lines.push(
        `- [observed:${observation.toolName}] ${observation.inputSummary || observation.outputSummary}`,
      );
    }
  }

  const identity = read.store.identity
    .filter((fact) => fact.confidence >= 0.7)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
  if (identity.length > 0) {
    lines.push("SNARC identity facts, confirm if task-critical:");
    for (const fact of identity) lines.push(`- [identity] ${fact.key}: ${fact.value}`);
  }

  const direct = options.query
    ? searchMemory(options.query, { rootDir: read.store.projectRoot, limit: 3 })
    : [];
  if (direct.length > 0) {
    lines.push("SNARC memories related to this prompt:");
    for (const item of direct) lines.push(`- [${item.provenance}] ${item.summary}`);
  }

  if (lines.length === 0) return "";
  const text = lines.join("\n");
  return text.length > maxChars ? `${text.slice(0, maxChars - 4)} ...` : text;
  // === END_BLOCK_BUILD_BRIEFING ===
}

// === START_CONTRACT: runConsolidation ===
// PURPOSE: Consolidate session observations into inferred patterns and decay stale low-confidence memory.
// INPUTS: sessionId: string; options?: ConsolidationOptions
// OUTPUTS: ConsolidationResult
// SIDE_EFFECTS: reads and transactionally writes .magra/snarc/memory.sqlite
// === END_CONTRACT: runConsolidation ===
export function runConsolidation(
  sessionId: string,
  options: ConsolidationOptions = {},
): ConsolidationResult {
  // === START_BLOCK_CONSOLIDATE_PATTERNS ===
  const read = readStore(options.rootDir ?? process.cwd());
  if (!read.ok) {
    return {
      patternsCreated: 0,
      patternsDecayed: 0,
      patternsPruned: 0,
      observationsProcessed: 0,
      logMarker: LOG_MARKERS.consolidate,
    };
  }

  const now = options.now ?? new Date().toISOString();
  const targetSession = sessionId.trim() || "default";
  const sessionObservations = read.store.observations
    .filter((observation) => observation.sessionId === targetSession)
    .sort((a, b) => a.ts.localeCompare(b.ts));

  const beforePrune = read.store.patterns.length;
  let patternsDecayed = 0;
  for (const pattern of read.store.patterns) {
    const ageDays = Math.max(0, (Date.parse(now) - Date.parse(pattern.lastSeen)) / 86_400_000);
    if (ageDays > 1) {
      pattern.confidence = clamp(
        pattern.confidence - (0.05 / (1 + Math.log2(pattern.frequency + 1))) * ageDays,
      );
      patternsDecayed++;
    }
  }
  read.store.patterns = read.store.patterns.filter((pattern) => pattern.confidence >= 0.1);
  const patternsPruned = beforePrune - read.store.patterns.length;

  let patternsCreated = 0;
  patternsCreated += extractToolSequencePatterns(read.store, sessionObservations, now);
  patternsCreated += extractErrorFixPatterns(read.store, sessionObservations, now);
  patternsCreated += extractConceptPatterns(read.store, sessionObservations, now);

  read.store.patterns = read.store.patterns
    .sort((a, b) => b.confidence - a.confidence || b.frequency - a.frequency)
    .slice(0, MAX_PATTERNS);
  const session = read.store.sessions[targetSession];
  if (session)
    read.store.sessions[targetSession] = {
      ...session,
      endedAt: now,
      obsCount: sessionObservations.length,
    };
  writeStoreAtomic(read.path, read.store);

  return {
    patternsCreated,
    patternsDecayed,
    patternsPruned,
    observationsProcessed: sessionObservations.length,
    logMarker: LOG_MARKERS.consolidate,
  };
  // === END_BLOCK_CONSOLIDATE_PATTERNS ===
}

// === START_CONTRACT: readSnarcStats ===
// PURPOSE: Read bounded SNARC health and counts for doctor, dashboard, and native tools.
// INPUTS: rootDir?: string
// OUTPUTS: SnarcStats
// SIDE_EFFECTS: reads filesystem metadata and SQLite memory file
// === END_CONTRACT: readSnarcStats ===
export function readSnarcStats(rootDir = process.cwd()): SnarcStats {
  // === START_BLOCK_READ_STATS ===
  const read = readStore(rootDir);
  const path = resolveSnarcMemoryPath(rootDir);
  if (!read.ok) {
    return {
      path,
      available: false,
      observations: 0,
      patterns: 0,
      identityFacts: 0,
      seenTokens: 0,
      sessions: 0,
      avgSalience: null,
      lastObservation: null,
      totalBytes: fileSize(path),
      detail: read.error,
    };
  }
  const salience = read.store.observations.map((observation) => observation.salience);
  return {
    path,
    available: true,
    observations: read.store.observations.length,
    patterns: read.store.patterns.length,
    identityFacts: read.store.identity.length,
    seenTokens: Object.keys(read.store.seenTokens).length,
    sessions: Object.keys(read.store.sessions).length,
    avgSalience:
      salience.length > 0
        ? salience.reduce((sum, value) => sum + value, 0) / salience.length
        : null,
    lastObservation: read.store.observations[0]?.ts ?? null,
    totalBytes: fileSize(path),
    detail: "SNARC memory is available.",
  };
  // === END_BLOCK_READ_STATS ===
}

// === START_CONTRACT: listSnarcPatterns ===
// PURPOSE: Return bounded inferred pattern rows for dashboard and MAGRA tools.
// INPUTS: rootDir?: string; limit?: number
// OUTPUTS: SnarcPattern[]
// SIDE_EFFECTS: reads .magra/snarc/memory.sqlite
// === END_CONTRACT: listSnarcPatterns ===
export function listSnarcPatterns(rootDir = process.cwd(), limit = 20): SnarcPattern[] {
  // === START_BLOCK_LIST_PATTERNS ===
  const read = readStore(rootDir);
  if (!read.ok) return [];
  return read.store.patterns
    .sort((a, b) => b.confidence - a.confidence || b.frequency - a.frequency)
    .slice(0, Math.max(1, Math.min(limit, 100)))
    .map((pattern) => ({ ...pattern, sourceIds: [...pattern.sourceIds], tags: [...pattern.tags] }));
  // === END_BLOCK_LIST_PATTERNS ===
}

// === START_CONTRACT: listSnarcIdentityFacts ===
// PURPOSE: Return bounded identity/proposed fact rows with provenance labels.
// INPUTS: rootDir?: string; limit?: number
// OUTPUTS: SnarcIdentityFact[]
// SIDE_EFFECTS: reads .magra/snarc/memory.sqlite
// === END_CONTRACT: listSnarcIdentityFacts ===
export function listSnarcIdentityFacts(rootDir = process.cwd(), limit = 20): SnarcIdentityFact[] {
  // === START_BLOCK_LIST_IDENTITY ===
  const read = readStore(rootDir);
  if (!read.ok) return [];
  return read.store.identity
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, Math.max(1, Math.min(limit, 100)))
    .map((fact) => ({ ...fact }));
  // === END_BLOCK_LIST_IDENTITY ===
}

function readStore(rootDir: string): StoreRead {
  const projectRoot = resolve(rootDir);
  return readSnarcStoreSnapshot(projectRoot, { emptyStore, normalizeStore });
}

function writeStoreAtomic(
  path: string,
  store: SnarcStore,
): { ok: true } | { ok: false; error: string } {
  return writeSnarcStoreSnapshot(path, store);
}

function emptyStore(projectRoot: string): SnarcStore {
  return {
    version: 1,
    projectRoot,
    observations: [],
    patterns: [],
    identity: [],
    seenTokens: {},
    transitions: {},
    sessions: {},
  };
}

function normalizeStore(raw: Partial<SnarcStore>, projectRoot: string): SnarcStore {
  return {
    version: 1,
    projectRoot: typeof raw.projectRoot === "string" ? raw.projectRoot : projectRoot,
    observations: Array.isArray(raw.observations) ? raw.observations.filter(isObservation) : [],
    patterns: Array.isArray(raw.patterns) ? raw.patterns.filter(isPattern) : [],
    identity: Array.isArray(raw.identity) ? raw.identity.filter(isIdentityFact) : [],
    seenTokens: isRecord(raw.seenTokens) ? normalizeSeen(raw.seenTokens) : {},
    transitions: isRecord(raw.transitions) ? normalizeTransitions(raw.transitions) : {},
    sessions: isRecord(raw.sessions) ? normalizeSessions(raw.sessions) : {},
  };
}

function scoreObservation(
  store: SnarcStore,
  input: {
    toolName: string;
    inputSummary: string;
    outputSummary: string;
    cwd: string;
    exitCode?: number;
    tokens: string[];
    now: string;
  },
): SnarcScores {
  const surprise = scoreSurprise(store, input.toolName);
  const novelty = scoreNovelty(store, input.tokens);
  const arousal = scoreArousal(
    input.outputSummary,
    input.inputSummary,
    input.toolName,
    input.exitCode,
  );
  const reward = scoreReward(input.outputSummary, input.inputSummary, input.toolName);
  const conflict = scoreConflict(store, input.toolName, input.inputSummary, input.outputSummary);
  const salience = clamp(
    WEIGHTS.surprise * surprise +
      WEIGHTS.novelty * novelty +
      WEIGHTS.arousal * arousal +
      WEIGHTS.reward * reward +
      WEIGHTS.conflict * conflict,
  );
  return { surprise, novelty, arousal, reward, conflict, salience };
}

function scoreSurprise(store: SnarcStore, toolName: string): number {
  const previous = store.observations[0]?.toolName;
  if (!previous) return 0.5;
  const key = `${previous}->${toolName}`;
  const count = store.transitions[key] ?? 0;
  const prefix = `${previous}->`;
  const maxCount =
    Object.entries(store.transitions)
      .filter(([name]) => name.startsWith(prefix))
      .reduce((max, [, value]) => Math.max(max, value), 1) || 1;
  store.transitions[key] = count + 1;
  return count === 0 ? 0.8 : clamp(1 - Math.min(count / maxCount, 1));
}

function scoreNovelty(store: SnarcStore, tokens: string[]): number {
  if (tokens.length === 0) return 0.3;
  const newCount = tokens.filter((token) => !store.seenTokens[token]).length;
  return clamp(newCount / tokens.length);
}

function scoreArousal(output: string, input: string, toolName: string, exitCode?: number): number {
  let arousal = 0.15;
  if (exitCode !== undefined && exitCode !== 0) arousal += 0.5;
  if (ERROR_PATTERNS.test(output)) arousal += 0.3;
  if (WARNING_PATTERNS.test(output)) arousal += 0.15;
  if (STATE_CHANGE_PATTERNS.test(output) || STATE_CHANGE_PATTERNS.test(input)) arousal += 0.15;
  if (toolName === "write_file" || toolName === "edit_file" || toolName === "multi_edit")
    arousal += 0.35;
  if (
    toolName === "run_command" &&
    /\bgit\s+(commit|push|merge|rebase|reset|checkout)\b/i.test(input)
  ) {
    arousal += 0.25;
  }
  if (output.length > 200) arousal += 0.1;
  if (SUCCESS_PATTERNS.test(output)) arousal += 0.1;
  return clamp(arousal);
}

function scoreReward(output: string, input: string, toolName: string): number {
  if (SUCCESS_PATTERNS.test(output) && /test|spec|vitest|jest|pytest/i.test(input)) return 0.8;
  if (toolName === "run_command" && /\bgit\s+commit\b/i.test(input)) return 0.7;
  if (SUCCESS_PATTERNS.test(output) && /build|compile|typecheck|lint/i.test(input)) return 0.65;
  if (
    (toolName === "write_file" || toolName === "edit_file" || toolName === "multi_edit") &&
    !ERROR_PATTERNS.test(output)
  ) {
    return 0.5;
  }
  if (ERROR_PATTERNS.test(output)) return 0.08;
  if (toolName === "read_file" || toolName === "search_files" || toolName === "directory_tree")
    return 0.25;
  if (/install|setup|init|create/i.test(input)) return 0.4;
  if (output.length > 100) return 0.35;
  return 0.25;
}

function scoreConflict(store: SnarcStore, toolName: string, input: string, output: string): number {
  const target = extractTarget(input);
  if (!target) return 0;
  const currentSuccess = !ERROR_PATTERNS.test(output);
  const recent = store.observations
    .filter(
      (observation) =>
        observation.toolName === toolName && extractTarget(observation.inputSummary) === target,
    )
    .slice(0, 5);
  const prior = recent[0];
  if (prior) {
    const priorSuccess = !ERROR_PATTERNS.test(prior.outputSummary);
    if (priorSuccess !== currentSuccess) return priorSuccess ? 0.8 : 0.4;
  }
  return recent.length >= 2 ? 0.3 : 0;
}

function extractToolSequencePatterns(
  store: SnarcStore,
  observations: SnarcObservation[],
  now: string,
): number {
  if (observations.length < 5) return 0;
  const counts = new Map<string, string[]>();
  for (let index = 0; index <= observations.length - 3; index++) {
    const window = observations.slice(index, index + 3);
    const sequence = window.map((item) => item.toolName).join(" -> ");
    counts.set(sequence, [...(counts.get(sequence) ?? []), ...window.map((item) => item.id)]);
  }
  let created = 0;
  for (const [sequence, ids] of counts) {
    if (ids.length < 6) continue;
    created += upsertPattern(store, {
      kind: "tool_sequence",
      summary: `Recurring workflow: ${sequence}`,
      detail: JSON.stringify({
        sequence: sequence.split(" -> "),
        observationIds: [...new Set(ids)],
      }),
      sourceIds: [...new Set(ids)],
      confidence: Math.min(0.9, 0.5 + ids.length / 30),
      tags: ["workflow"],
      now,
    });
  }
  return created;
}

function extractErrorFixPatterns(
  store: SnarcStore,
  observations: SnarcObservation[],
  now: string,
): number {
  let created = 0;
  for (let index = 0; index < observations.length - 1; index++) {
    const current = observations[index];
    if (!current || !ERROR_PATTERNS.test(current.outputSummary)) continue;
    for (let offset = index + 1; offset < Math.min(index + 6, observations.length); offset++) {
      const candidate = observations[offset];
      if (!candidate || !SUCCESS_PATTERNS.test(candidate.outputSummary)) continue;
      if (extractTarget(current.inputSummary) !== extractTarget(candidate.inputSummary)) continue;
      created += upsertPattern(store, {
        kind: "error_fix",
        summary: `Error ${summarize(current.outputSummary, 80)} -> fix ${summarize(candidate.inputSummary, 120)}`,
        detail: JSON.stringify({ error: current.outputSummary, fix: candidate.inputSummary }),
        sourceIds: [current.id, candidate.id],
        confidence: 0.62,
        tags: ["error", "fix"],
        now,
      });
      break;
    }
  }
  return created;
}

function extractConceptPatterns(
  store: SnarcStore,
  observations: SnarcObservation[],
  now: string,
): number {
  const fileToIds = new Map<string, string[]>();
  for (const observation of observations) {
    for (const file of extractFiles(observation.inputSummary)) {
      fileToIds.set(file, [...(fileToIds.get(file) ?? []), observation.id]);
    }
  }
  let created = 0;
  for (const [file, ids] of fileToIds) {
    if (ids.length < 3) continue;
    created += upsertPattern(store, {
      kind: "concept_cluster",
      summary: `Focused work on ${file}`,
      detail: JSON.stringify({ file, observationCount: ids.length }),
      sourceIds: [...new Set(ids)],
      confidence: Math.min(0.8, 0.4 + ids.length * 0.08),
      tags: ["file", file],
      now,
    });
  }
  return created;
}

function upsertPattern(
  store: SnarcStore,
  input: {
    kind: string;
    summary: string;
    detail: string;
    sourceIds: string[];
    confidence: number;
    tags: string[];
    now: string;
  },
): number {
  const existing = store.patterns.find(
    (pattern) => pattern.kind === input.kind && pattern.summary === input.summary,
  );
  if (existing) {
    existing.frequency += 1;
    existing.confidence = Math.max(existing.confidence, input.confidence);
    existing.sourceIds = [...new Set([...existing.sourceIds, ...input.sourceIds])];
    existing.tags = [...new Set([...existing.tags, ...input.tags])];
    existing.lastSeen = input.now;
    if (input.detail.length > existing.detail.length) existing.detail = input.detail;
    return 0;
  }
  store.patterns.push({
    id: randomUUID(),
    kind: input.kind,
    summary: input.summary,
    detail: input.detail,
    frequency: 1,
    sourceIds: [...new Set(input.sourceIds)],
    confidence: clamp(input.confidence),
    lastSeen: input.now,
    provenance: "inferred",
    tags: [...new Set(input.tags)],
  });
  return 1;
}

function summarize(value: string, maxLen: number): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length <= maxLen ? cleaned : `${cleaned.slice(0, Math.max(0, maxLen - 3))}...`;
}

function toText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!metadata) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === "string") out[key] = summarize(redactSnarcText(value), 300);
    else if (typeof value === "number" || typeof value === "boolean" || value === null)
      out[key] = value;
  }
  return out;
}

function extractTokens(text: string): string[] {
  const tokens = new Set<string>();
  const redacted = redactSnarcText(text);
  for (const match of redacted.matchAll(/[\w./-]+\.[A-Za-z0-9]{1,10}/g))
    tokens.add(match[0].toLowerCase());
  for (const match of redacted.matchAll(/[A-Z][A-Z0-9_]{3,}/g)) tokens.add(match[0].toLowerCase());
  for (const match of redacted.matchAll(/\b[A-Za-z_][A-Za-z0-9_-]{3,40}\b/g)) {
    const token = match[0].toLowerCase();
    if (!STOP_WORDS.has(token)) tokens.add(token);
  }
  return [...tokens].slice(0, TOKEN_LIMIT);
}

function extractTags(toolName: string, input: string, output: string): string[] {
  const tags = new Set<string>([toolName.toLowerCase()]);
  for (const ext of input.match(/\.([a-z0-9]{1,8})\b/gi) ?? []) tags.add(ext.toLowerCase());
  if (ERROR_PATTERNS.test(output)) tags.add("error");
  if (SUCCESS_PATTERNS.test(output)) tags.add("success");
  if (/\bgit\s+(commit|push|pull|merge|rebase)\b/i.test(input)) tags.add("git");
  if (/test|spec|vitest|jest|pytest/i.test(input)) tags.add("test");
  return [...tags].slice(0, 20);
}

function extractTarget(input: string): string {
  const file = input.match(/[\w./-]+\.[A-Za-z0-9]{1,10}/)?.[0];
  return file ? file.toLowerCase() : input.slice(0, 80).toLowerCase();
}

function extractFiles(input: string): string[] {
  return [
    ...new Set(
      (input.match(/[\w./-]+\.[A-Za-z0-9]{1,10}/g) ?? []).map((file) => file.toLowerCase()),
    ),
  ];
}

function lexicalScore(queryTokens: string[], fields: string[]): number {
  const haystack = extractTokens(fields.join(" "));
  if (haystack.length === 0) return 0;
  const set = new Set(haystack);
  const overlap = queryTokens.filter((token) => set.has(token)).length;
  if (overlap === 0) return 0;
  return overlap / Math.max(queryTokens.length, 1);
}

function emptyScores(): SnarcScores {
  return {
    surprise: 0,
    novelty: 0,
    arousal: 0,
    reward: 0,
    conflict: 0,
    salience: 0,
  };
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function fileSize(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSeen(value: Record<string, unknown>): Record<string, SeenToken> {
  const out: Record<string, SeenToken> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!isRecord(item)) continue;
    const firstSeen =
      typeof item.firstSeen === "string" ? item.firstSeen : new Date().toISOString();
    const count = typeof item.count === "number" && item.count > 0 ? item.count : 1;
    out[key] = { firstSeen, count };
  }
  return out;
}

function normalizeTransitions(value: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, count] of Object.entries(value)) {
    if (typeof count === "number" && Number.isFinite(count) && count > 0) out[key] = count;
  }
  return out;
}

function normalizeSessions(value: Record<string, unknown>): Record<string, SnarcSession> {
  const out: Record<string, SnarcSession> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!isRecord(item)) continue;
    const sessionId = typeof item.sessionId === "string" ? item.sessionId : key;
    const startedAt =
      typeof item.startedAt === "string" ? item.startedAt : new Date().toISOString();
    const cwd = typeof item.cwd === "string" ? item.cwd : "";
    const obsCount = typeof item.obsCount === "number" ? item.obsCount : 0;
    out[key] = {
      sessionId,
      startedAt,
      ...(typeof item.endedAt === "string" ? { endedAt: item.endedAt } : {}),
      cwd,
      obsCount,
    };
  }
  return out;
}

function isObservation(value: unknown): value is SnarcObservation {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.sessionId === "string" &&
    typeof value.ts === "string" &&
    typeof value.toolName === "string"
  );
}

function isPattern(value: unknown): value is SnarcPattern {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.kind === "string" &&
    typeof value.summary === "string" &&
    typeof value.confidence === "number"
  );
}

function isIdentityFact(value: unknown): value is SnarcIdentityFact {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.key === "string" &&
    typeof value.value === "string" &&
    typeof value.confidence === "number"
  );
}

const STOP_WORDS = new Set([
  "about",
  "after",
  "before",
  "const",
  "false",
  "function",
  "import",
  "null",
  "return",
  "string",
  "true",
  "undefined",
  "with",
]);
