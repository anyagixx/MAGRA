// === MODULE_CONTRACT ===
// FILE: src/snarc/sqlite-store.ts
// VERSION: 1.0.0
// PURPOSE: Provide the approved SQLite-backed project store for MAGRA SNARC memory.
// SCOPE: Schema creation, migrations, transactional snapshot writes, legacy JSON import, bounded corrupt-store errors, and SQL row queries.
// DEPENDS: M-SNARC-MEMORY,M-REASONIX-BASE
// LINKS: docs/modules/M-SNARC-SQLITE-STORE.xml
// ROLE: DATA_LAYER
// MAP_MODE: EXPORTS
// START_MODULE_CONTRACT
// END_MODULE_CONTRACT
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Exports: openSnarcStore, migrateSnarcStore, importLegacyJsonMemory, querySnarcRows, readSnarcStoreSnapshot, writeSnarcStoreSnapshot, resolveSnarcSqlitePath, resolveSnarcLegacyJsonPath
// Locals: readSnapshot, replaceSnapshot, importLegacyJsonMemoryWithConnection, insertSnapshotRows, querySnapshotRows
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Added SQLite store adapter for SNARC memory with legacy JSON import and transactional writes.
// === END_CHANGE_SUMMARY ===

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import type {
  SearchMemoryOptions,
  SeenToken,
  SnarcIdentityFact,
  SnarcObservation,
  SnarcPattern,
  SnarcProvenance,
  SnarcSearchResult,
  SnarcSession,
  SnarcStore,
  StoreRead,
} from "./memory.js";

export const SNARC_SQLITE_SCHEMA_VERSION = 1;

export interface SnarcStoreConnection {
  path: string;
  projectRoot: string;
  database: DatabaseSyncType;
  close(): void;
}

export interface MigrationResult {
  ok: boolean;
  path: string;
  schemaVersion: number;
  applied: string[];
  error?: string;
  logMarker: string;
}

export interface ImportCounts {
  observations: number;
  patterns: number;
  identityFacts: number;
  seenTokens: number;
  transitions: number;
  sessions: number;
}

export interface ImportResult {
  ok: boolean;
  legacyPath: string;
  sqlitePath: string;
  imported: ImportCounts;
  skipped: ImportCounts;
  error?: string;
  logMarker: string;
}

export interface SnarcStoreCodec {
  emptyStore(projectRoot: string): SnarcStore;
  normalizeStore(raw: Partial<SnarcStore>, projectRoot: string): SnarcStore;
}

type SqlMode = "INSERT OR IGNORE" | "INSERT OR REPLACE";
type Row = Record<string, unknown>;
type SqliteModule = typeof import("node:sqlite");

const requireBuiltin = createRequire(import.meta.url);
const { DatabaseSync } = loadSqliteModule();

const LOG_MARKERS = Object.freeze({
  migrate: "[SnarcSqliteStore][migrateSnarcStore][BLOCK_MIGRATE_SCHEMA]",
  importLegacy: "[SnarcSqliteStore][importLegacyJsonMemory][BLOCK_IMPORT_LEGACY_JSON]",
  query: "[SnarcSqliteStore][querySnarcRows][BLOCK_QUERY_ROWS]",
  write: "[SnarcSqliteStore][writeSnarcStoreSnapshot][BLOCK_TRANSACTIONAL_WRITE]",
});

const ZERO_COUNTS: ImportCounts = Object.freeze({
  observations: 0,
  patterns: 0,
  identityFacts: 0,
  seenTokens: 0,
  transitions: 0,
  sessions: 0,
});

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  input_summary TEXT NOT NULL,
  output_summary TEXT NOT NULL,
  cwd TEXT NOT NULL,
  provenance TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  scores_json TEXT NOT NULL,
  salience REAL NOT NULL,
  confidence REAL NOT NULL,
  metadata_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snarc_observations_ts ON observations(ts DESC);
CREATE INDEX IF NOT EXISTS idx_snarc_observations_session ON observations(session_id);
CREATE INDEX IF NOT EXISTS idx_snarc_observations_confidence ON observations(confidence DESC);
CREATE TABLE IF NOT EXISTS patterns (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail TEXT NOT NULL,
  frequency INTEGER NOT NULL,
  source_ids_json TEXT NOT NULL,
  confidence REAL NOT NULL,
  last_seen TEXT NOT NULL,
  provenance TEXT NOT NULL,
  tags_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snarc_patterns_confidence ON patterns(confidence DESC);
CREATE TABLE IF NOT EXISTS identity_facts (
  id TEXT PRIMARY KEY,
  fact_key TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence REAL NOT NULL,
  created_at TEXT NOT NULL,
  provenance TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snarc_identity_confidence ON identity_facts(confidence DESC);
CREATE TABLE IF NOT EXISTS seen_tokens (
  token TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL,
  count INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS transitions (
  transition_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  cwd TEXT NOT NULL,
  obs_count INTEGER NOT NULL
);
`;

function loadSqliteModule(): SqliteModule {
  const originalEmitWarning = process.emitWarning;
  const emitWarning = originalEmitWarning.bind(process) as (...args: unknown[]) => void;
  process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
    const message = typeof warning === "string" ? warning : warning.message;
    if (message.includes("SQLite is an experimental feature")) return;
    emitWarning(warning, ...args);
  }) as typeof process.emitWarning;
  try {
    return requireBuiltin("node:sqlite") as SqliteModule;
  } finally {
    process.emitWarning = originalEmitWarning;
  }
}

// === START_CONTRACT: resolveSnarcSqlitePath ===
// PURPOSE: Resolve the primary SQLite SNARC memory path for a project root.
// INPUTS: rootDir?: string
// OUTPUTS: string
// SIDE_EFFECTS: none
// === END_CONTRACT: resolveSnarcSqlitePath ===
export function resolveSnarcSqlitePath(rootDir = process.cwd()): string {
  // === START_BLOCK_RESOLVE_SQLITE_PATH ===
  return join(resolve(rootDir), ".magra", "snarc", "memory.sqlite");
  // === END_BLOCK_RESOLVE_SQLITE_PATH ===
}

// === START_CONTRACT: resolveSnarcLegacyJsonPath ===
// PURPOSE: Resolve the legacy JSON SNARC memory path retained for migration/import.
// INPUTS: rootDir?: string
// OUTPUTS: string
// SIDE_EFFECTS: none
// === END_CONTRACT: resolveSnarcLegacyJsonPath ===
export function resolveSnarcLegacyJsonPath(rootDir = process.cwd()): string {
  // === START_BLOCK_RESOLVE_LEGACY_PATH ===
  return join(resolve(rootDir), ".magra", "snarc", "memory.json");
  // === END_BLOCK_RESOLVE_LEGACY_PATH ===
}

// === START_CONTRACT: openSnarcStore ===
// PURPOSE: Open a project-scoped SQLite SNARC store connection.
// INPUTS: rootDir?: string
// OUTPUTS: SnarcStoreConnection
// SIDE_EFFECTS: creates .magra/snarc directory when absent
// === END_CONTRACT: openSnarcStore ===
export function openSnarcStore(rootDir = process.cwd()): SnarcStoreConnection {
  // === START_BLOCK_OPEN_STORE ===
  const projectRoot = resolve(rootDir);
  return openSnarcStoreAtPath(resolveSnarcSqlitePath(projectRoot), projectRoot);
  // === END_BLOCK_OPEN_STORE ===
}

// === START_CONTRACT: migrateSnarcStore ===
// PURPOSE: Create or migrate SNARC SQLite schema to the current MAGRA schema version.
// INPUTS: connection: SnarcStoreConnection
// OUTPUTS: MigrationResult
// SIDE_EFFECTS: writes SQLite schema metadata and migration rows
// === END_CONTRACT: migrateSnarcStore ===
export function migrateSnarcStore(connection: SnarcStoreConnection): MigrationResult {
  // === START_BLOCK_MIGRATE_SCHEMA ===
  const applied: string[] = [];
  try {
    connection.database.exec("PRAGMA foreign_keys = ON");
    connection.database.exec("PRAGMA journal_mode = WAL");
    connection.database.exec(SCHEMA_SQL);
    const current = getUserVersion(connection.database);
    if (current > SNARC_SQLITE_SCHEMA_VERSION) {
      return {
        ok: false,
        path: connection.path,
        schemaVersion: current,
        applied,
        error: `unsupported future SNARC schema version ${current}`,
        logMarker: LOG_MARKERS.migrate,
      };
    }
    if (current < SNARC_SQLITE_SCHEMA_VERSION) {
      connection.database.exec(`PRAGMA user_version = ${SNARC_SQLITE_SCHEMA_VERSION}`);
      connection.database
        .prepare("INSERT OR IGNORE INTO migrations(version, applied_at) VALUES (?, ?)")
        .run(SNARC_SQLITE_SCHEMA_VERSION, new Date().toISOString());
      applied.push(`schema-${SNARC_SQLITE_SCHEMA_VERSION}`);
    }
    setMeta(connection.database, "schema_version", String(SNARC_SQLITE_SCHEMA_VERSION));
    setMeta(connection.database, "project_root", connection.projectRoot);
    return {
      ok: true,
      path: connection.path,
      schemaVersion: SNARC_SQLITE_SCHEMA_VERSION,
      applied,
      logMarker: LOG_MARKERS.migrate,
    };
  } catch (err) {
    return {
      ok: false,
      path: connection.path,
      schemaVersion: 0,
      applied,
      error: (err as Error).message,
      logMarker: LOG_MARKERS.migrate,
    };
  }
  // === END_BLOCK_MIGRATE_SCHEMA ===
}

// === START_CONTRACT: importLegacyJsonMemory ===
// PURPOSE: Import `.magra/snarc/memory.json` into SQLite without duplicate row inflation.
// INPUTS: rootDir?: string
// OUTPUTS: ImportResult
// SIDE_EFFECTS: transactionally inserts legacy JSON rows into .magra/snarc/memory.sqlite
// === END_CONTRACT: importLegacyJsonMemory ===
export function importLegacyJsonMemory(rootDir = process.cwd()): ImportResult {
  // === START_BLOCK_IMPORT_LEGACY_JSON ===
  const projectRoot = resolve(rootDir);
  let connection: SnarcStoreConnection | null = null;
  try {
    connection = openSnarcStore(projectRoot);
    const migration = migrateSnarcStore(connection);
    if (!migration.ok) {
      return failedImport(projectRoot, migration.error ?? "migration failed");
    }
    return importLegacyJsonMemoryWithConnection(connection, SQLITE_STORE_CODEC);
  } catch (err) {
    return failedImport(projectRoot, (err as Error).message);
  } finally {
    connection?.close();
  }
  // === END_BLOCK_IMPORT_LEGACY_JSON ===
}

// === START_CONTRACT: readSnarcStoreSnapshot ===
// PURPOSE: Read a normalized SNARC store snapshot from SQLite after migration and legacy import.
// INPUTS: rootDir: string; codec: SnarcStoreCodec
// OUTPUTS: StoreRead
// SIDE_EFFECTS: may create/migrate SQLite DB and import legacy JSON
// === END_CONTRACT: readSnarcStoreSnapshot ===
export function readSnarcStoreSnapshot(rootDir: string, codec: SnarcStoreCodec): StoreRead {
  // === START_BLOCK_READ_SNAPSHOT ===
  const projectRoot = resolve(rootDir);
  let connection: SnarcStoreConnection | null = null;
  try {
    connection = openSnarcStore(projectRoot);
    const migration = migrateSnarcStore(connection);
    if (!migration.ok) {
      return { ok: false, path: connection.path, error: migration.error ?? "migration failed" };
    }
    const legacyImport = importLegacyJsonMemoryWithConnection(connection, codec);
    if (!legacyImport.ok) {
      return {
        ok: false,
        path: connection.path,
        error: `legacy-import-failed: ${legacyImport.error ?? "unknown error"}`,
      };
    }
    return { ok: true, path: connection.path, store: readSnapshot(connection, codec) };
  } catch (err) {
    return { ok: false, path: resolveSnarcSqlitePath(projectRoot), error: (err as Error).message };
  } finally {
    connection?.close();
  }
  // === END_BLOCK_READ_SNAPSHOT ===
}

// === START_CONTRACT: writeSnarcStoreSnapshot ===
// PURPOSE: Transactionally replace SQLite store rows with one normalized SNARC snapshot.
// INPUTS: path: string; store: SnarcStore
// OUTPUTS: { ok: true } | { ok: false; error: string }
// SIDE_EFFECTS: writes .magra/snarc/memory.sqlite transactionally
// === END_CONTRACT: writeSnarcStoreSnapshot ===
export function writeSnarcStoreSnapshot(
  path: string,
  store: SnarcStore,
): { ok: true } | { ok: false; error: string } {
  // === START_BLOCK_TRANSACTIONAL_WRITE ===
  let connection: SnarcStoreConnection | null = null;
  try {
    connection = openSnarcStoreAtPath(path, resolve(store.projectRoot));
    const migration = migrateSnarcStore(connection);
    if (!migration.ok) return { ok: false, error: migration.error ?? "migration failed" };
    replaceSnapshot(connection, store);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  } finally {
    connection?.close();
  }
  // === END_BLOCK_TRANSACTIONAL_WRITE ===
}

// === START_CONTRACT: querySnarcRows ===
// PURPOSE: Query SQLite-backed SNARC rows and return provenance-labeled ranked memory results.
// INPUTS: query: string; options?: SearchMemoryOptions
// OUTPUTS: SnarcSearchResult[]
// SIDE_EFFECTS: reads .magra/snarc/memory.sqlite and may import legacy JSON first
// === END_CONTRACT: querySnarcRows ===
export function querySnarcRows(
  query: string,
  options: SearchMemoryOptions = {},
): SnarcSearchResult[] {
  // === START_BLOCK_QUERY_ROWS ===
  const read = readSnarcStoreSnapshot(options.rootDir ?? process.cwd(), SQLITE_STORE_CODEC);
  if (!read.ok) return [];
  return querySnapshotRows(read.store, query, options);
  // === END_BLOCK_QUERY_ROWS ===
}

function openSnarcStoreAtPath(path: string, projectRoot: string): SnarcStoreConnection {
  mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  return {
    path,
    projectRoot,
    database,
    close: () => database.close(),
  };
}

function readSnapshot(connection: SnarcStoreConnection, codec: SnarcStoreCodec): SnarcStore {
  const raw: Partial<SnarcStore> = {
    version: 1,
    projectRoot: getMeta(connection.database, "project_root") ?? connection.projectRoot,
    observations: connection.database
      .prepare(
        "SELECT id, session_id, ts, tool_name, input_summary, output_summary, cwd, provenance, tags_json, scores_json, salience, confidence, metadata_json FROM observations ORDER BY ts DESC",
      )
      .all()
      .map(rowToObservation),
    patterns: connection.database
      .prepare(
        "SELECT id, kind, summary, detail, frequency, source_ids_json, confidence, last_seen, provenance, tags_json FROM patterns ORDER BY confidence DESC, frequency DESC",
      )
      .all()
      .map(rowToPattern),
    identity: connection.database
      .prepare(
        "SELECT id, fact_key, value, source, confidence, created_at, provenance FROM identity_facts ORDER BY confidence DESC",
      )
      .all()
      .map(rowToIdentityFact),
    seenTokens: Object.fromEntries(
      connection.database
        .prepare("SELECT token, first_seen, count FROM seen_tokens")
        .all()
        .map((row) => {
          const record = row as Row;
          return [
            String(record.token ?? ""),
            {
              firstSeen: String(record.first_seen ?? new Date().toISOString()),
              count: asPositiveNumber(record.count, 1),
            } satisfies SeenToken,
          ];
        }),
    ),
    transitions: Object.fromEntries(
      connection.database
        .prepare("SELECT transition_key, count FROM transitions")
        .all()
        .map((row) => {
          const record = row as Row;
          return [String(record.transition_key ?? ""), asPositiveNumber(record.count, 1)];
        }),
    ),
    sessions: Object.fromEntries(
      connection.database
        .prepare("SELECT session_id, started_at, ended_at, cwd, obs_count FROM sessions")
        .all()
        .map((row) => {
          const record = row as Row;
          const sessionId = String(record.session_id ?? "default");
          return [
            sessionId,
            {
              sessionId,
              startedAt: String(record.started_at ?? new Date().toISOString()),
              ...(typeof record.ended_at === "string" ? { endedAt: record.ended_at } : {}),
              cwd: String(record.cwd ?? ""),
              obsCount: asPositiveNumber(record.obs_count, 0),
            } satisfies SnarcSession,
          ];
        }),
    ),
  };
  return codec.normalizeStore(raw, connection.projectRoot);
}

function replaceSnapshot(connection: SnarcStoreConnection, store: SnarcStore): void {
  const db = connection.database;
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(
      "DELETE FROM observations; DELETE FROM patterns; DELETE FROM identity_facts; DELETE FROM seen_tokens; DELETE FROM transitions; DELETE FROM sessions;",
    );
    setMeta(db, "schema_version", String(SNARC_SQLITE_SCHEMA_VERSION));
    setMeta(db, "project_root", store.projectRoot);
    insertSnapshotRows(db, store, "INSERT OR REPLACE", false);
    db.exec("COMMIT");
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* rollback best effort */
    }
    throw err;
  }
}

function importLegacyJsonMemoryWithConnection(
  connection: SnarcStoreConnection,
  codec: SnarcStoreCodec,
): ImportResult {
  const legacyPath = resolveSnarcLegacyJsonPath(connection.projectRoot);
  if (!existsSync(legacyPath)) {
    return {
      ok: true,
      legacyPath,
      sqlitePath: connection.path,
      imported: { ...ZERO_COUNTS },
      skipped: { ...ZERO_COUNTS },
      logMarker: LOG_MARKERS.importLegacy,
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(legacyPath, "utf8")) as Partial<SnarcStore>;
    const store = codec.normalizeStore(parsed, connection.projectRoot);
    const totals = countSnapshot(store);
    const imported = insertSnapshotRows(connection.database, store, "INSERT OR IGNORE", true);
    setMeta(connection.database, "legacy_json_path", legacyPath);
    setMeta(connection.database, "legacy_json_last_import", new Date().toISOString());
    return {
      ok: true,
      legacyPath,
      sqlitePath: connection.path,
      imported,
      skipped: subtractCounts(totals, imported),
      logMarker: LOG_MARKERS.importLegacy,
    };
  } catch (err) {
    return failedImport(connection.projectRoot, (err as Error).message);
  }
}

function insertSnapshotRows(
  db: DatabaseSyncType,
  store: SnarcStore,
  mode: SqlMode,
  wrapTransaction: boolean,
): ImportCounts {
  const counts: ImportCounts = { ...ZERO_COUNTS };
  if (wrapTransaction) db.exec("BEGIN IMMEDIATE");
  try {
    for (const observation of store.observations) {
      counts.observations += changeCount(
        db
          .prepare(
            `${mode} INTO observations(id, session_id, ts, tool_name, input_summary, output_summary, cwd, provenance, tags_json, scores_json, salience, confidence, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            observation.id,
            observation.sessionId,
            observation.ts,
            observation.toolName,
            observation.inputSummary,
            observation.outputSummary,
            observation.cwd,
            observation.provenance,
            json(observation.tags),
            json(observation.scores),
            observation.salience,
            observation.confidence,
            json(observation.metadata),
          ),
      );
    }

    for (const pattern of store.patterns) {
      counts.patterns += changeCount(
        db
          .prepare(
            `${mode} INTO patterns(id, kind, summary, detail, frequency, source_ids_json, confidence, last_seen, provenance, tags_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            pattern.id,
            pattern.kind,
            pattern.summary,
            pattern.detail,
            pattern.frequency,
            json(pattern.sourceIds),
            pattern.confidence,
            pattern.lastSeen,
            pattern.provenance,
            json(pattern.tags),
          ),
      );
    }

    for (const fact of store.identity) {
      counts.identityFacts += changeCount(
        db
          .prepare(
            `${mode} INTO identity_facts(id, fact_key, value, source, confidence, created_at, provenance) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            fact.id,
            fact.key,
            fact.value,
            fact.source,
            fact.confidence,
            fact.createdAt,
            fact.provenance,
          ),
      );
    }

    for (const [token, seen] of Object.entries(store.seenTokens)) {
      counts.seenTokens += changeCount(
        db
          .prepare(`${mode} INTO seen_tokens(token, first_seen, count) VALUES (?, ?, ?)`)
          .run(token, seen.firstSeen, seen.count),
      );
    }

    for (const [transition, count] of Object.entries(store.transitions)) {
      counts.transitions += changeCount(
        db
          .prepare(`${mode} INTO transitions(transition_key, count) VALUES (?, ?)`)
          .run(transition, count),
      );
    }

    for (const session of Object.values(store.sessions)) {
      counts.sessions += changeCount(
        db
          .prepare(
            `${mode} INTO sessions(session_id, started_at, ended_at, cwd, obs_count) VALUES (?, ?, ?, ?, ?)`,
          )
          .run(
            session.sessionId,
            session.startedAt,
            session.endedAt ?? null,
            session.cwd,
            session.obsCount,
          ),
      );
    }

    if (wrapTransaction) db.exec("COMMIT");
    return counts;
  } catch (err) {
    if (wrapTransaction) {
      try {
        db.exec("ROLLBACK");
      } catch {
        /* rollback best effort */
      }
    }
    throw err;
  }
}

function querySnapshotRows(
  store: SnarcStore,
  query: string,
  options: SearchMemoryOptions,
): SnarcSearchResult[] {
  const queryTokens = tokenizeQuery(query);
  if (queryTokens.length === 0) return [];
  const allowed = options.provenance ? new Set(options.provenance) : null;
  const minConfidence = clamp(options.minConfidence ?? 0);
  const results: SnarcSearchResult[] = [];

  if (!allowed || allowed.has("observed")) {
    for (const observation of store.observations) {
      const score = tokenScore(queryTokens, [
        observation.toolName,
        observation.inputSummary,
        observation.outputSummary,
        observation.tags.join(" "),
      ]);
      if (score <= 0 || observation.confidence < minConfidence) continue;
      results.push({
        id: observation.id,
        tier: 1,
        summary: `[${observation.toolName}] ${observation.inputSummary || observation.outputSummary}`,
        provenance: "observed",
        confidence: observation.confidence,
        salience: observation.salience,
        score: score + observation.salience + observation.confidence * 0.2,
        ts: observation.ts,
        sessionId: observation.sessionId,
        tags: [...observation.tags],
      });
    }
  }

  if (!allowed || allowed.has("inferred")) {
    for (const pattern of store.patterns) {
      const score = tokenScore(queryTokens, [
        pattern.kind,
        pattern.summary,
        pattern.detail,
        pattern.tags.join(" "),
      ]);
      if (score <= 0 || pattern.confidence < minConfidence) continue;
      results.push({
        id: pattern.id,
        tier: 2,
        summary: pattern.summary,
        provenance: "inferred",
        confidence: pattern.confidence,
        score: score + pattern.confidence + Math.min(pattern.frequency / 10, 0.5),
        kind: pattern.kind,
        tags: [...pattern.tags],
      });
    }
  }

  if (!allowed || allowed.has("identity")) {
    for (const fact of store.identity) {
      const score = tokenScore(queryTokens, [fact.key, fact.value, fact.source]);
      if (score <= 0 || fact.confidence < minConfidence) continue;
      results.push({
        id: fact.id,
        tier: 3,
        summary: `${fact.key}: ${fact.value}`,
        provenance: "identity",
        confidence: fact.confidence,
        score: score + fact.confidence,
        tags: ["identity", fact.key],
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
    .slice(0, Math.max(1, Math.min(options.limit ?? 10, 50)));
}

function rowToObservation(row: unknown): SnarcObservation {
  const record = row as Row;
  return {
    id: String(record.id ?? ""),
    sessionId: String(record.session_id ?? "default"),
    ts: String(record.ts ?? new Date().toISOString()),
    toolName: String(record.tool_name ?? "conversation"),
    inputSummary: String(record.input_summary ?? ""),
    outputSummary: String(record.output_summary ?? ""),
    cwd: String(record.cwd ?? ""),
    provenance: "observed",
    tags: parseStringArray(record.tags_json),
    scores: parseScores(record.scores_json),
    salience: clamp(asNumber(record.salience, 0)),
    confidence: clamp(asNumber(record.confidence, 0)),
    metadata: parseJsonRecord(record.metadata_json),
  };
}

function rowToPattern(row: unknown): SnarcPattern {
  const record = row as Row;
  return {
    id: String(record.id ?? ""),
    kind: String(record.kind ?? "pattern"),
    summary: String(record.summary ?? ""),
    detail: String(record.detail ?? ""),
    frequency: asPositiveNumber(record.frequency, 1),
    sourceIds: parseStringArray(record.source_ids_json),
    confidence: clamp(asNumber(record.confidence, 0)),
    lastSeen: String(record.last_seen ?? new Date().toISOString()),
    provenance: "inferred",
    tags: parseStringArray(record.tags_json),
  };
}

function rowToIdentityFact(row: unknown): SnarcIdentityFact {
  const record = row as Row;
  return {
    id: String(record.id ?? ""),
    key: String(record.fact_key ?? ""),
    value: String(record.value ?? ""),
    source: String(record.source ?? ""),
    confidence: clamp(asNumber(record.confidence, 0)),
    createdAt: String(record.created_at ?? new Date().toISOString()),
    provenance: "identity",
  };
}

function getUserVersion(db: DatabaseSyncType): number {
  const row = db.prepare("PRAGMA user_version").get() as Row | undefined;
  return asPositiveNumber(row?.user_version, 0);
}

function setMeta(db: DatabaseSyncType, key: string, value: string): void {
  db.prepare(
    "INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}

function getMeta(db: DatabaseSyncType, key: string): string | null {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as Row | undefined;
  return typeof row?.value === "string" ? row.value : null;
}

function failedImport(projectRoot: string, error: string): ImportResult {
  return {
    ok: false,
    legacyPath: resolveSnarcLegacyJsonPath(projectRoot),
    sqlitePath: resolveSnarcSqlitePath(projectRoot),
    imported: { ...ZERO_COUNTS },
    skipped: { ...ZERO_COUNTS },
    error,
    logMarker: LOG_MARKERS.importLegacy,
  };
}

function countSnapshot(store: SnarcStore): ImportCounts {
  return {
    observations: store.observations.length,
    patterns: store.patterns.length,
    identityFacts: store.identity.length,
    seenTokens: Object.keys(store.seenTokens).length,
    transitions: Object.keys(store.transitions).length,
    sessions: Object.keys(store.sessions).length,
  };
}

function subtractCounts(total: ImportCounts, imported: ImportCounts): ImportCounts {
  return {
    observations: Math.max(0, total.observations - imported.observations),
    patterns: Math.max(0, total.patterns - imported.patterns),
    identityFacts: Math.max(0, total.identityFacts - imported.identityFacts),
    seenTokens: Math.max(0, total.seenTokens - imported.seenTokens),
    transitions: Math.max(0, total.transitions - imported.transitions),
    sessions: Math.max(0, total.sessions - imported.sessions),
  };
}

function changeCount(result: { changes?: number | bigint }): number {
  return typeof result.changes === "bigint" ? Number(result.changes) : (result.changes ?? 0);
}

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function parseStringArray(value: unknown): string[] {
  const parsed = parseJson(value);
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : [];
}

function parseJsonRecord(value: unknown): Record<string, unknown> {
  const parsed = parseJson(value);
  return isRecord(parsed) ? parsed : {};
}

function parseScores(value: unknown): SnarcObservation["scores"] {
  const parsed = parseJson(value);
  return {
    surprise: isRecord(parsed) ? clamp(asNumber(parsed.surprise, 0)) : 0,
    novelty: isRecord(parsed) ? clamp(asNumber(parsed.novelty, 0)) : 0,
    arousal: isRecord(parsed) ? clamp(asNumber(parsed.arousal, 0)) : 0,
    reward: isRecord(parsed) ? clamp(asNumber(parsed.reward, 0)) : 0,
    conflict: isRecord(parsed) ? clamp(asNumber(parsed.conflict, 0)) : 0,
    salience: isRecord(parsed) ? clamp(asNumber(parsed.salience, 0)) : 0,
  };
}

function tokenizeQuery(text: string): string[] {
  const tokens = new Set<string>();
  for (const match of text.matchAll(/\b[A-Za-z0-9_.-]{3,40}\b/g)) {
    const token = match[0].toLowerCase();
    if (!SQLITE_STOP_WORDS.has(token)) tokens.add(token);
  }
  return [...tokens].slice(0, 30);
}

function tokenScore(tokens: string[], fields: string[]): number {
  const haystack = fields.join(" ").toLowerCase();
  const overlap = tokens.filter((token) => haystack.includes(token)).length;
  return overlap === 0 ? 0 : overlap / Math.max(tokens.length, 1);
}

function normalizeSqliteStore(raw: Partial<SnarcStore>, projectRoot: string): SnarcStore {
  return {
    version: 1,
    projectRoot: typeof raw.projectRoot === "string" ? raw.projectRoot : projectRoot,
    observations: Array.isArray(raw.observations)
      ? raw.observations.filter(isObservationLike).map((item) => ({
          ...item,
          provenance: "observed",
          tags: Array.isArray(item.tags) ? item.tags.filter(isString) : [],
          metadata: isRecord(item.metadata) ? item.metadata : {},
        }))
      : [],
    patterns: Array.isArray(raw.patterns)
      ? raw.patterns.filter(isPatternLike).map((item) => ({
          ...item,
          provenance: "inferred",
          sourceIds: Array.isArray(item.sourceIds) ? item.sourceIds.filter(isString) : [],
          tags: Array.isArray(item.tags) ? item.tags.filter(isString) : [],
        }))
      : [],
    identity: Array.isArray(raw.identity)
      ? raw.identity.filter(isIdentityLike).map((item) => ({ ...item, provenance: "identity" }))
      : [],
    seenTokens: normalizeSeen(raw.seenTokens),
    transitions: normalizeTransitions(raw.transitions),
    sessions: normalizeSessions(raw.sessions),
  };
}

function emptySqliteStore(projectRoot: string): SnarcStore {
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

const SQLITE_STORE_CODEC: SnarcStoreCodec = {
  emptyStore: emptySqliteStore,
  normalizeStore: normalizeSqliteStore,
};

function normalizeSeen(value: unknown): Record<string, SeenToken> {
  if (!isRecord(value)) return {};
  const out: Record<string, SeenToken> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!isRecord(item)) continue;
    out[key] = {
      firstSeen: typeof item.firstSeen === "string" ? item.firstSeen : new Date().toISOString(),
      count: asPositiveNumber(item.count, 1),
    };
  }
  return out;
}

function normalizeTransitions(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, count] of Object.entries(value)) {
    if (typeof count === "number" && Number.isFinite(count) && count > 0) out[key] = count;
  }
  return out;
}

function normalizeSessions(value: unknown): Record<string, SnarcSession> {
  if (!isRecord(value)) return {};
  const out: Record<string, SnarcSession> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!isRecord(item)) continue;
    const sessionId = typeof item.sessionId === "string" ? item.sessionId : key;
    out[sessionId] = {
      sessionId,
      startedAt: typeof item.startedAt === "string" ? item.startedAt : new Date().toISOString(),
      ...(typeof item.endedAt === "string" ? { endedAt: item.endedAt } : {}),
      cwd: typeof item.cwd === "string" ? item.cwd : "",
      obsCount: asPositiveNumber(item.obsCount, 0),
    };
  }
  return out;
}

function isObservationLike(value: unknown): value is SnarcObservation {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.sessionId === "string" &&
    typeof value.ts === "string" &&
    typeof value.toolName === "string"
  );
}

function isPatternLike(value: unknown): value is SnarcPattern {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.kind === "string" &&
    typeof value.summary === "string" &&
    typeof value.confidence === "number"
  );
}

function isIdentityLike(value: unknown): value is SnarcIdentityFact {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.key === "string" &&
    typeof value.value === "string" &&
    typeof value.confidence === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asPositiveNumber(value: unknown, fallback: number): number {
  const number = asNumber(value, fallback);
  return number >= 0 ? number : fallback;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

const SQLITE_STOP_WORDS = new Set([
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
