// === MODULE_CONTRACT ===
// FILE: src/snarc/loop-adapter.ts
// VERSION: 1.0.0
// PURPOSE: Connect MAGRA prompt, tool, compaction, and stop events to SNARC memory capture and injection.
// SCOPE: UserPromptSubmit, PostToolUse, pre-compaction capture, stop consolidation, failure isolation, and context formatting.
// DEPENDS: M-SNARC-MEMORY,M-REASONIX-BASE
// LINKS: docs/modules/M-SNARC-LOOP-ADAPTER.xml
// ROLE: INTEGRATION
// MAP_MODE: EXPORTS
// START_MODULE_CONTRACT
// END_MODULE_CONTRACT
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Exports: createSnarcLoopAdapter, SnarcLoopAdapter, onUserPromptSubmit, onPostToolUse, onPreCompact, onStop types
// Locals: safeCall, formatMemoryContext, serializeMessagesForCompaction, failedCaptureResult
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial SNARC loop adapter for MAGRA prompt injection, tool capture, compaction capture, and stop consolidation.
// === END_CHANGE_SUMMARY ===

import {
  type CaptureObservationInput,
  type CaptureResult,
  type ConsolidationResult,
  type SearchMemoryOptions,
  type SnarcSearchResult,
  captureObservation,
  getSessionBriefing,
  runConsolidation,
  searchMemory,
} from "./memory.js";

export interface AdditionalContext {
  context: string;
  warnings: string[];
  results: SnarcSearchResult[];
  captured?: CaptureResult;
  logMarker: string;
}

export interface PostToolUsePayload {
  rootDir?: string;
  sessionId?: string;
  cwd?: string;
  turn?: number;
  toolName: string;
  toolArgs?: unknown;
  toolResult?: unknown;
  exitCode?: number;
}

export interface UserPromptSubmitPayload {
  rootDir?: string;
  sessionId?: string;
  cwd?: string;
  turn?: number;
  prompt: string;
}

export interface PreCompactPayload {
  rootDir?: string;
  sessionId?: string;
  cwd?: string;
  turn?: number;
  reason?: string;
  messages: readonly unknown[];
}

export interface PreCompactResult {
  captured: boolean;
  warnings: string[];
  capture?: CaptureResult;
  logMarker: string;
}

export interface StopPayload {
  rootDir?: string;
  sessionId?: string;
  cwd?: string;
  turn?: number;
  lastAssistantText?: string;
  deepDream?: boolean;
}

export interface StopResult {
  consolidated: boolean;
  warnings: string[];
  result?: ConsolidationResult;
  logMarker: string;
}

export interface SnarcMemoryDriver {
  captureObservation: (input: CaptureObservationInput) => CaptureResult;
  searchMemory: (query: string, options?: SearchMemoryOptions) => SnarcSearchResult[];
  getSessionBriefing: (
    rootDir?: string,
    options?: { rootDir?: string; maxChars?: number; query?: string },
  ) => string;
  runConsolidation: (
    sessionId: string,
    options?: { rootDir?: string; now?: string },
  ) => ConsolidationResult;
}

export interface SnarcLoopAdapterOptions {
  memory?: Partial<SnarcMemoryDriver>;
  maxPromptContextChars?: number;
  captureUserPrompts?: boolean;
}

export interface SnarcLoopAdapter {
  onUserPromptSubmit(payload: UserPromptSubmitPayload): Promise<AdditionalContext>;
  onPostToolUse(payload: PostToolUsePayload): Promise<CaptureResult>;
  onPreCompact(payload: PreCompactPayload): Promise<PreCompactResult>;
  onStop(payload: StopPayload): Promise<StopResult>;
}

const LOG_MARKERS = Object.freeze({
  prompt: "[SnarcLoopAdapter][onUserPromptSubmit][BLOCK_INJECT_MEMORY]",
  captureTool: "[SnarcLoopAdapter][onPostToolUse][BLOCK_CAPTURE_TOOL]",
  compact: "[SnarcLoopAdapter][onPreCompact][BLOCK_CAPTURE_CONVERSATION]",
  stop: "[SnarcLoopAdapter][onStop][BLOCK_CONSOLIDATE_STOP]",
});

const DEFAULT_MEMORY: SnarcMemoryDriver = {
  captureObservation,
  searchMemory,
  getSessionBriefing,
  runConsolidation,
};

// === START_CONTRACT: createSnarcLoopAdapter ===
// PURPOSE: Create a failure-isolated SNARC adapter for MAGRA runtime loops.
// INPUTS: options?: SnarcLoopAdapterOptions
// OUTPUTS: SnarcLoopAdapter
// SIDE_EFFECTS: none until adapter methods are called
// === END_CONTRACT: createSnarcLoopAdapter ===
export function createSnarcLoopAdapter(options: SnarcLoopAdapterOptions = {}): SnarcLoopAdapter {
  const memory: SnarcMemoryDriver = { ...DEFAULT_MEMORY, ...options.memory };
  const maxPromptContextChars = Math.max(
    400,
    Math.min(options.maxPromptContextChars ?? 2400, 8000),
  );
  const captureUserPrompts = options.captureUserPrompts !== false;

  return {
    async onUserPromptSubmit(payload): Promise<AdditionalContext> {
      // === START_BLOCK_INJECT_MEMORY ===
      const rootDir = payload.rootDir ?? process.cwd();
      const search = await safeCall(
        () => memory.searchMemory(payload.prompt, { rootDir, limit: 5, minConfidence: 0.35 }),
        [] as SnarcSearchResult[],
      );
      const briefing = await safeCall(
        () =>
          memory.getSessionBriefing(rootDir, {
            query: payload.prompt,
            maxChars: maxPromptContextChars,
          }),
        "",
      );

      const warnings: string[] = [...search.warnings, ...briefing.warnings];
      let captured: CaptureResult | undefined;
      if (captureUserPrompts) {
        const capture = await safeCall(
          () =>
            memory.captureObservation({
              rootDir,
              sessionId: payload.sessionId,
              cwd: payload.cwd,
              toolName: "user_prompt",
              input: payload.prompt,
              output: "",
              tags: ["prompt"],
              metadata: { turn: payload.turn ?? null },
            }),
          failedCaptureResult(LOG_MARKERS.prompt, "prompt-capture-failed"),
        );
        captured = { ...capture.value, logMarker: LOG_MARKERS.prompt };
        warnings.push(...capture.warnings);
      }

      return {
        context: formatMemoryContext(briefing.value, search.value),
        warnings,
        results: search.value,
        ...(captured ? { captured } : {}),
        logMarker: LOG_MARKERS.prompt,
      };
      // === END_BLOCK_INJECT_MEMORY ===
    },

    async onPostToolUse(payload): Promise<CaptureResult> {
      // === START_BLOCK_CAPTURE_TOOL ===
      const capture = await safeCall(
        () =>
          memory.captureObservation({
            rootDir: payload.rootDir,
            sessionId: payload.sessionId,
            cwd: payload.cwd,
            toolName: payload.toolName,
            input: payload.toolArgs,
            output: payload.toolResult,
            exitCode: payload.exitCode,
            tags: ["tool", payload.toolName],
            metadata: { turn: payload.turn ?? null },
          }),
        failedCaptureResult(LOG_MARKERS.captureTool, "tool-capture-failed"),
      );
      return { ...capture.value, logMarker: LOG_MARKERS.captureTool };
      // === END_BLOCK_CAPTURE_TOOL ===
    },

    async onPreCompact(payload): Promise<PreCompactResult> {
      // === START_BLOCK_CAPTURE_CONVERSATION ===
      const text = serializeMessagesForCompaction(payload.messages);
      if (!text.trim()) {
        return {
          captured: false,
          warnings: [],
          logMarker: LOG_MARKERS.compact,
        };
      }
      const capture = await safeCall(
        () =>
          memory.captureObservation({
            rootDir: payload.rootDir,
            sessionId: payload.sessionId,
            cwd: payload.cwd,
            toolName: "compact_history",
            input: payload.reason ?? "pre-compact",
            output: text,
            threshold: 0.05,
            tags: ["compaction", "conversation"],
            metadata: { turn: payload.turn ?? null, messageCount: payload.messages.length },
          }),
        failedCaptureResult(LOG_MARKERS.compact, "compaction-capture-failed"),
      );
      return {
        captured: capture.value.captured,
        warnings: capture.warnings,
        capture: { ...capture.value, logMarker: LOG_MARKERS.compact },
        logMarker: LOG_MARKERS.compact,
      };
      // === END_BLOCK_CAPTURE_CONVERSATION ===
    },

    async onStop(payload): Promise<StopResult> {
      // === START_BLOCK_CONSOLIDATE_STOP ===
      const sessionId = payload.sessionId?.trim() || "default";
      const consolidation = await safeCall(
        () => memory.runConsolidation(sessionId, { rootDir: payload.rootDir }),
        null as ConsolidationResult | null,
      );
      const warnings = [...consolidation.warnings];
      if (payload.deepDream) {
        warnings.push(
          "SNARC deep dream is optional in MAGRA and is not run without an explicit model client.",
        );
      }
      return {
        consolidated: consolidation.value !== null,
        warnings,
        ...(consolidation.value ? { result: consolidation.value } : {}),
        logMarker: LOG_MARKERS.stop,
      };
      // === END_BLOCK_CONSOLIDATE_STOP ===
    },
  };
}

async function safeCall<T>(
  fn: () => T | Promise<T>,
  fallback: T,
): Promise<{ value: T; warnings: string[] }> {
  try {
    return { value: await fn(), warnings: [] };
  } catch (err) {
    return { value: fallback, warnings: [(err as Error).message] };
  }
}

function formatMemoryContext(briefing: string, results: SnarcSearchResult[]): string {
  const lines: string[] = [];
  if (briefing.trim()) lines.push(briefing.trim());
  const extra = results.slice(0, 3);
  if (extra.length > 0) {
    lines.push("SNARC direct matches:");
    for (const result of extra) lines.push(`- [${result.provenance}] ${result.summary}`);
  }
  if (lines.length === 0) return "";
  return [
    "<snarc_memory_context>",
    "Treat this as fallible local memory. Provenance labels are authoritative.",
    ...lines,
    "</snarc_memory_context>",
  ].join("\n");
}

function serializeMessagesForCompaction(messages: readonly unknown[]): string {
  const lines: string[] = [];
  for (const message of messages.slice(-30)) {
    if (!message || typeof message !== "object") {
      lines.push(String(message));
      continue;
    }
    const record = message as Record<string, unknown>;
    const role = typeof record.role === "string" ? record.role : "message";
    const content =
      typeof record.content === "string"
        ? record.content
        : Array.isArray(record.content)
          ? JSON.stringify(record.content)
          : "";
    const toolName = typeof record.toolName === "string" ? ` ${record.toolName}` : "";
    const compact = content.replace(/\s+/g, " ").trim();
    if (compact) lines.push(`[${role}${toolName}] ${compact.slice(0, 600)}`);
  }
  return lines.join("\n").slice(0, 8000);
}

function failedCaptureResult(logMarker: string, reason: string): CaptureResult {
  return {
    captured: false,
    reason,
    logMarker,
    score: {
      surprise: 0,
      novelty: 0,
      arousal: 0,
      reward: 0,
      conflict: 0,
      salience: 0,
    },
  };
}
