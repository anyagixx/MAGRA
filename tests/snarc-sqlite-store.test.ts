// === MODULE_CONTRACT ===
// FILE: tests/snarc-sqlite-store.test.ts
// VERSION: 1.0.0
// PURPOSE: Verify MAGRA SNARC SQLite store schema, migration, import, query, and corrupt-store behavior.
// SCOPE: Primary SQLite path, table writes, legacy JSON import, duplicate skips, provenance query, and bounded corrupt DB errors.
// DEPENDS: M-SNARC-SQLITE-STORE,M-SNARC-MEMORY
// LINKS: docs/verification/V-M-SNARC-SQLITE-STORE.xml
// ROLE: TEST
// MAP_MODE: LOCALS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: openDatabase, writeLegacyStore, SNARC SQLite store assertions
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Added SQLite store verification for MAGRA SNARC memory.
// === END_CHANGE_SUMMARY ===

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  captureObservation,
  readSnarcStats,
  resolveSnarcMemoryPath,
  searchMemory,
} from "../src/snarc/memory.js";
import type { SnarcStore } from "../src/snarc/memory.js";
import {
  importLegacyJsonMemory,
  querySnarcRows,
  resolveSnarcLegacyJsonPath,
  resolveSnarcSqlitePath,
} from "../src/snarc/sqlite-store.js";

type Row = Record<string, unknown>;
type SqliteModule = typeof import("node:sqlite");

const requireBuiltin = createRequire(import.meta.url);
const { DatabaseSync } = requireBuiltin("node:sqlite") as SqliteModule;

function openDatabase(path: string): DatabaseSyncType {
  return new DatabaseSync(path);
}

function writeLegacyStore(rootDir: string): string {
  const legacyPath = resolveSnarcLegacyJsonPath(rootDir);
  mkdirSync(dirname(legacyPath), { recursive: true });
  const legacy: SnarcStore = {
    version: 1,
    projectRoot: rootDir,
    observations: [
      {
        id: "legacy-observation-1",
        sessionId: "legacy-session",
        ts: "2026-05-29T00:00:00.000Z",
        toolName: "run_command",
        inputSummary: "legacy sqlite import query",
        outputSummary: "PASS legacy SQLite import kept provenance",
        cwd: rootDir,
        provenance: "observed",
        tags: ["legacy", "sqlite"],
        scores: {
          surprise: 0.5,
          novelty: 0.5,
          arousal: 0.5,
          reward: 0.5,
          conflict: 0,
          salience: 0.6,
        },
        salience: 0.6,
        confidence: 0.8,
        metadata: { source: "legacy-json" },
      },
    ],
    patterns: [
      {
        id: "legacy-pattern-1",
        kind: "concept_cluster",
        summary: "Legacy SQLite import pattern",
        detail: "legacy import pattern detail",
        frequency: 2,
        sourceIds: ["legacy-observation-1"],
        confidence: 0.75,
        lastSeen: "2026-05-29T00:00:00.000Z",
        provenance: "inferred",
        tags: ["legacy"],
      },
    ],
    identity: [
      {
        id: "legacy-identity-1",
        key: "project",
        value: "MAGRA SQLite migration",
        source: "legacy",
        confidence: 0.9,
        createdAt: "2026-05-29T00:00:00.000Z",
        provenance: "identity",
      },
    ],
    seenTokens: { legacy: { firstSeen: "2026-05-29T00:00:00.000Z", count: 1 } },
    transitions: { "read_file->run_command": 1 },
    sessions: {
      "legacy-session": {
        sessionId: "legacy-session",
        startedAt: "2026-05-29T00:00:00.000Z",
        cwd: rootDir,
        obsCount: 1,
      },
    },
  };
  writeFileSync(legacyPath, `${JSON.stringify(legacy, null, 2)}\n`, "utf8");
  return legacyPath;
}

describe("SNARC SQLite store", () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), "magra-snarc-sqlite-"));
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it("uses memory.sqlite as the primary store and writes normalized observation rows", () => {
    // === START_BLOCK_ASSERT_SQLITE_PRIMARY_STORE ===
    const result = captureObservation({
      rootDir,
      sessionId: "sqlite-1",
      toolName: "run_command",
      input: "npm test -- tests/snarc-sqlite-store.test.ts",
      output: "PASS SQLite SNARC store query confidence",
    });

    const sqlitePath = resolveSnarcSqlitePath(rootDir);
    expect(result.captured).toBe(true);
    expect(resolveSnarcMemoryPath(rootDir)).toBe(sqlitePath);
    expect(existsSync(sqlitePath)).toBe(true);

    const db = openDatabase(sqlitePath);
    try {
      const meta = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as Row;
      const row = db
        .prepare("SELECT * FROM observations WHERE session_id = ?")
        .get("sqlite-1") as Row;
      expect(meta.value).toBe("1");
      expect(row.provenance).toBe("observed");
      expect(row.input_summary).toContain("snarc-sqlite-store.test.ts");
      expect(JSON.parse(String(row.tags_json))).toContain("test");
    } finally {
      db.close();
    }
    // === END_BLOCK_ASSERT_SQLITE_PRIMARY_STORE ===
  });

  it("imports legacy JSON without duplicate inflation and preserves provenance query results", () => {
    // === START_BLOCK_ASSERT_LEGACY_IMPORT ===
    const legacyPath = writeLegacyStore(rootDir);
    const firstImport = importLegacyJsonMemory(rootDir);
    const secondImport = importLegacyJsonMemory(rootDir);

    expect(firstImport.ok).toBe(true);
    expect(firstImport.legacyPath).toBe(legacyPath);
    expect(firstImport.imported).toMatchObject({
      observations: 1,
      patterns: 1,
      identityFacts: 1,
      sessions: 1,
    });
    expect(secondImport.ok).toBe(true);
    expect(secondImport.skipped.observations).toBe(1);

    const observed = searchMemory("legacy sqlite import", { rootDir, provenance: ["observed"] });
    expect(observed[0]).toMatchObject({
      id: "legacy-observation-1",
      provenance: "observed",
      sessionId: "legacy-session",
    });

    const inferred = querySnarcRows("legacy import pattern", {
      rootDir,
      provenance: ["inferred"],
    });
    expect(inferred[0]).toMatchObject({ id: "legacy-pattern-1", provenance: "inferred" });

    const identity = querySnarcRows("MAGRA SQLite migration", {
      rootDir,
      provenance: ["identity"],
    });
    expect(identity[0]).toMatchObject({ id: "legacy-identity-1", provenance: "identity" });
    // === END_BLOCK_ASSERT_LEGACY_IMPORT ===
  });

  it("bounds corrupt SQLite errors and does not overwrite existing database bytes", () => {
    // === START_BLOCK_ASSERT_CORRUPT_SQLITE_BOUNDED ===
    const sqlitePath = resolveSnarcSqlitePath(rootDir);
    mkdirSync(dirname(sqlitePath), { recursive: true });
    writeFileSync(sqlitePath, "not a sqlite database", "utf8");
    const before = readFileSync(sqlitePath);

    const result = captureObservation({
      rootDir,
      sessionId: "corrupt-1",
      toolName: "run_command",
      input: "npm test",
      output: "PASS",
    });

    expect(result.captured).toBe(false);
    expect(result.reason).toContain("memory-load-failed");
    expect(readFileSync(sqlitePath)).toEqual(before);

    const stats = readSnarcStats(rootDir);
    expect(stats.available).toBe(false);
    expect(stats.path).toBe(sqlitePath);
    expect(stats.detail.length).toBeGreaterThan(0);
    // === END_BLOCK_ASSERT_CORRUPT_SQLITE_BOUNDED ===
  });
});
