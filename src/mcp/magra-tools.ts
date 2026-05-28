// === MODULE_CONTRACT ===
// FILE: src/mcp/magra-tools.ts
// VERSION: 1.0.0
// PURPOSE: Expose MAGRA MyGRACE and SNARC operations through Reasonix native tool surfaces.
// SCOPE: Tool summaries, registry wiring, bounded invocation, MyGRACE navigation/lint, and SNARC search/context/pattern/stats tools.
// DEPENDS: M-MYGRACE-CLI-ADAPTER,M-SNARC-MEMORY,M-REASONIX-BASE
// LINKS: docs/modules/M-MCP-UNIFIED-BRIDGE.xml
// ROLE: INTEGRATION
// MAP_MODE: EXPORTS
// START_MODULE_CONTRACT
// END_MODULE_CONTRACT
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Exports: registerMagraTools, listMagraMcpTools, invokeMagraTool
// Locals: TOOL_SUMMARIES, handlers, boundedText, parseRoot, parseLimit, toToolError
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial MAGRA unified native tool bridge for MyGRACE and SNARC operations.
// === END_CHANGE_SUMMARY ===

import {
  mygraceFileShow,
  mygraceLint,
  mygraceModuleList,
  mygraceModuleShow,
  mygracePhaseShow,
  renderMyGraceLintReport,
} from "../mygrace/cli-adapter.js";
import {
  type SnarcProvenance,
  getSessionBriefing,
  listSnarcPatterns,
  readSnarcStats,
  searchMemory,
} from "../snarc/memory.js";
import type { ToolRegistry } from "../tools.js";
import type { JSONSchema } from "../types.js";

export interface MagraToolContext {
  rootDir?: string;
  maxChars?: number;
}

export interface MagraToolResult {
  ok: boolean;
  text: string;
  error?: string;
  logMarker: string;
}

export interface McpToolSummary {
  name: string;
  description: string;
  readOnly: boolean;
}

type ToolHandler = (
  args: Record<string, unknown>,
  context: MagraToolContext,
) => string | Promise<string>;

const LOG_MARKERS = Object.freeze({
  register: "[McpUnifiedBridge][registerMagraTools][BLOCK_REGISTER_TOOLS]",
  call: "[McpUnifiedBridge][invokeMagraTool][BLOCK_CALL_TOOL]",
});

const TOOL_SUMMARIES: readonly McpToolSummary[] = Object.freeze([
  {
    name: "mygrace_list_modules",
    description:
      "List MAGRA MyGRACE modules from docs/graph-index.xml with optional status/type filters.",
    readOnly: true,
  },
  {
    name: "mygrace_show_module",
    description: "Show one MAGRA MyGRACE module contract, optionally with verification.",
    readOnly: true,
  },
  {
    name: "mygrace_show_phase",
    description: "Show one MAGRA MyGRACE development phase by id, for example Phase-5.",
    readOnly: true,
  },
  {
    name: "mygrace_lint",
    description: "Run MyGRACE artifact lint for the current MAGRA project.",
    readOnly: true,
  },
  {
    name: "mygrace_show_file",
    description:
      "Show MyGRACE MODULE_CONTRACT, MODULE_MAP, CHANGE_SUMMARY, contracts, and blocks for a file.",
    readOnly: true,
  },
  {
    name: "snarc_search",
    description: "Search MAGRA SNARC local memory with provenance-labeled results.",
    readOnly: true,
  },
  {
    name: "snarc_context",
    description: "Build conservative SNARC context for a prompt or current session.",
    readOnly: true,
  },
  {
    name: "snarc_patterns",
    description: "List inferred SNARC patterns with confidence labels.",
    readOnly: true,
  },
  {
    name: "snarc_stats",
    description: "Show SNARC memory health and counts for the current MAGRA project.",
    readOnly: true,
  },
]);

const handlers: Record<string, ToolHandler> = {
  mygrace_list_modules: (args, context) =>
    mygraceModuleList(parseRoot(context), {
      status: readString(args.status),
      type: readString(args.type),
    }),

  mygrace_show_module: (args, context) => {
    const id = requiredString(args.id, "id");
    return mygraceModuleShow(parseRoot(context), id, {
      withVerification: args.withVerification === true,
    });
  },

  mygrace_show_phase: (args, context) =>
    mygracePhaseShow(parseRoot(context), requiredString(args.phase, "phase")),

  mygrace_lint: (_args, context) => renderMyGraceLintReport(mygraceLint(parseRoot(context))),

  mygrace_show_file: (args, context) =>
    mygraceFileShow(parseRoot(context), requiredString(args.path, "path"), {
      contracts: args.contracts === true,
      blocks: args.blocks === true,
    }),

  snarc_search: (args, context) => {
    const query = requiredString(args.query, "query");
    const provenance = parseProvenance(args.provenance);
    const results = searchMemory(query, {
      rootDir: parseRoot(context),
      limit: parseLimit(args.limit, 10),
      ...(provenance.length > 0 ? { provenance } : {}),
    });
    return JSON.stringify({ query, results }, null, 2);
  },

  snarc_context: (args, context) =>
    getSessionBriefing(parseRoot(context), {
      query: readString(args.query),
      maxChars: parseLimit(args.maxChars, 2000),
    }) || "No SNARC context available.",

  snarc_patterns: (args, context) =>
    JSON.stringify(
      { patterns: listSnarcPatterns(parseRoot(context), parseLimit(args.limit, 20)) },
      null,
      2,
    ),

  snarc_stats: (_args, context) => JSON.stringify(readSnarcStats(parseRoot(context)), null, 2),
};

// === START_CONTRACT: registerMagraTools ===
// PURPOSE: Register MAGRA MyGRACE and SNARC tools into an existing Reasonix ToolRegistry.
// INPUTS: registry: ToolRegistry; context?: MagraToolContext
// OUTPUTS: ToolRegistry
// SIDE_EFFECTS: mutates registry by adding or replacing MAGRA tool definitions
// === END_CONTRACT: registerMagraTools ===
export function registerMagraTools(
  registry: ToolRegistry,
  context: MagraToolContext = {},
): ToolRegistry {
  // === START_BLOCK_REGISTER_TOOLS ===
  for (const summary of TOOL_SUMMARIES) {
    registry.register({
      name: summary.name,
      description: summary.description,
      readOnly: true,
      parallelSafe: true,
      parameters: parametersFor(summary.name),
      fn: async (args: Record<string, unknown>) => {
        const result = await invokeMagraTool(summary.name, args, context);
        return result.ok ? result.text : toToolError(result);
      },
    });
  }
  return registry;
  // === END_BLOCK_REGISTER_TOOLS ===
}

// === START_CONTRACT: listMagraMcpTools ===
// PURPOSE: List MAGRA native tool metadata for MCP-compatible callers.
// INPUTS: none
// OUTPUTS: McpToolSummary[]
// SIDE_EFFECTS: none
// === END_CONTRACT: listMagraMcpTools ===
export function listMagraMcpTools(): McpToolSummary[] {
  // === START_BLOCK_LIST_TOOLS ===
  return TOOL_SUMMARIES.map((summary) => ({ ...summary }));
  // === END_BLOCK_LIST_TOOLS ===
}

// === START_CONTRACT: invokeMagraTool ===
// PURPOSE: Invoke one MAGRA MyGRACE or SNARC operation with bounded output and structured errors.
// INPUTS: name: string; args: Record<string, unknown>; context?: MagraToolContext
// OUTPUTS: Promise<MagraToolResult>
// SIDE_EFFECTS: reads MyGRACE docs or SNARC memory files
// === END_CONTRACT: invokeMagraTool ===
export async function invokeMagraTool(
  name: string,
  args: Record<string, unknown> = {},
  context: MagraToolContext = {},
): Promise<MagraToolResult> {
  // === START_BLOCK_CALL_TOOL ===
  const handler = handlers[name];
  if (!handler) {
    return {
      ok: false,
      text: `unknown MAGRA tool: ${name}`,
      error: `unknown MAGRA tool: ${name}`,
      logMarker: LOG_MARKERS.call,
    };
  }
  try {
    const text = await handler(args, context);
    return {
      ok: true,
      text: boundedText(String(text), context.maxChars),
      logMarker: LOG_MARKERS.call,
    };
  } catch (err) {
    const message = (err as Error).message;
    return {
      ok: false,
      text: message,
      error: message,
      logMarker: LOG_MARKERS.call,
    };
  }
  // === END_BLOCK_CALL_TOOL ===
}

function parseRoot(context: MagraToolContext): string {
  return context.rootDir ?? process.cwd();
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function requiredString(value: unknown, name: string): string {
  const parsed = readString(value);
  if (!parsed) throw new Error(`${name} is required`);
  return parsed;
}

function parseLimit(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(Math.floor(value), 100));
}

function parseProvenance(value: unknown): SnarcProvenance[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is SnarcProvenance =>
      item === "observed" || item === "inferred" || item === "identity",
  );
}

function boundedText(value: string, maxChars = 8000): string {
  const limit = Math.max(500, Math.min(maxChars, 32_000));
  return value.length <= limit
    ? value
    : `${value.slice(0, limit - 80)}\n[truncated ${value.length - limit + 80} chars]`;
}

function toToolError(result: MagraToolResult): string {
  return JSON.stringify({ error: result.error ?? result.text, logMarker: result.logMarker });
}

function parametersFor(name: string): JSONSchema {
  switch (name) {
    case "mygrace_list_modules":
      return {
        type: "object",
        properties: {
          status: { type: "string" },
          type: { type: "string" },
        },
      };
    case "mygrace_show_module":
      return {
        type: "object",
        properties: {
          id: { type: "string" },
          withVerification: { type: "boolean" },
        },
        required: ["id"],
      };
    case "mygrace_show_phase":
      return {
        type: "object",
        properties: {
          phase: { type: "string" },
        },
        required: ["phase"],
      };
    case "mygrace_show_file":
      return {
        type: "object",
        properties: {
          path: { type: "string" },
          contracts: { type: "boolean" },
          blocks: { type: "boolean" },
        },
        required: ["path"],
      };
    case "snarc_search":
      return {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number" },
          provenance: {
            type: "array",
            items: { type: "string", enum: ["observed", "inferred", "identity"] },
          },
        },
        required: ["query"],
      };
    case "snarc_context":
      return {
        type: "object",
        properties: {
          query: { type: "string" },
          maxChars: { type: "number" },
        },
      };
    case "snarc_patterns":
      return {
        type: "object",
        properties: {
          limit: { type: "number" },
        },
      };
    default:
      return { type: "object", properties: {} };
  }
}
