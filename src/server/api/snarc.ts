// === MODULE_CONTRACT ===
// FILE: src/server/api/snarc.ts
// VERSION: 1.0.0
// PURPOSE: Expose SNARC memory health, search, patterns, and identity facts to the MAGRA dashboard.
// SCOPE: Read-only dashboard API endpoints under /api/snarc.
// DEPENDS: M-SNARC-MEMORY
// LINKS: docs/modules/M-SNARC-DASHBOARD-API.xml
// ROLE: INTEGRATION
// MAP_MODE: EXPORTS
// START_MODULE_CONTRACT
// END_MODULE_CONTRACT
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Exports: handleSnarc
// Locals: parseLimit, parseProvenance
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial read-only dashboard API for MAGRA SNARC memory visibility.
// === END_CHANGE_SUMMARY ===

import {
  type SnarcProvenance,
  getSessionBriefing,
  listSnarcIdentityFacts,
  listSnarcPatterns,
  readSnarcStats,
  searchMemory,
} from "../../snarc/memory.js";
import type { DashboardContext } from "../context.js";
import type { ApiResult } from "../router.js";

function parseLimit(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(Math.floor(parsed), 100));
}

function parseProvenance(values: string[]): SnarcProvenance[] {
  return values.filter(
    (value): value is SnarcProvenance =>
      value === "observed" || value === "inferred" || value === "identity",
  );
}

export async function handleSnarc(
  method: string,
  rest: string[],
  _body: string,
  ctx: DashboardContext,
  query: URLSearchParams,
): Promise<ApiResult> {
  if (method !== "GET") return { status: 405, body: { error: "GET only" } };
  const rootDir = ctx.getCurrentCwd?.() ?? process.cwd();
  const head = rest[0] ?? "";

  if (head === "search") {
    const q = query.get("query") ?? query.get("q") ?? "";
    if (!q.trim()) return { status: 400, body: { error: "query required" } };
    const provenance = parseProvenance(query.getAll("provenance"));
    return {
      status: 200,
      body: {
        rootDir,
        results: searchMemory(q, {
          rootDir,
          limit: parseLimit(query.get("limit"), 10),
          ...(provenance.length > 0 ? { provenance } : {}),
        }),
      },
    };
  }

  if (head === "context") {
    return {
      status: 200,
      body: {
        rootDir,
        context: getSessionBriefing(rootDir, {
          query: query.get("query") ?? undefined,
          maxChars: parseLimit(query.get("maxChars"), 2000),
        }),
      },
    };
  }

  if (head === "patterns") {
    return {
      status: 200,
      body: {
        rootDir,
        patterns: listSnarcPatterns(rootDir, parseLimit(query.get("limit"), 20)),
      },
    };
  }

  if (head === "identity") {
    return {
      status: 200,
      body: {
        rootDir,
        identity: listSnarcIdentityFacts(rootDir, parseLimit(query.get("limit"), 20)),
      },
    };
  }

  return {
    status: 200,
    body: {
      rootDir,
      stats: readSnarcStats(rootDir),
      patterns: listSnarcPatterns(rootDir, 10),
      identity: listSnarcIdentityFacts(rootDir, 10),
    },
  };
}
