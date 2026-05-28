// === MODULE_CONTRACT ===
// FILE: tests/snarc-loop-adapter.test.ts
// VERSION: 1.0.0
// PURPOSE: Verify MAGRA SNARC loop adapter prompt, tool, compaction, and stop behavior.
// SCOPE: UserPromptSubmit injection, PostToolUse capture, pre-compaction capture, stop consolidation, and failure isolation.
// DEPENDS: M-SNARC-LOOP-ADAPTER
// LINKS: docs/verification/V-M-SNARC-LOOP-ADAPTER.xml
// ROLE: TEST
// MAP_MODE: LOCALS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: SNARC loop adapter unit assertions
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial verification for MAGRA SNARC loop adapter.
// === END_CHANGE_SUMMARY ===

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSnarcLoopAdapter } from "../src/snarc/loop-adapter.js";
import { captureObservation, searchMemory } from "../src/snarc/memory.js";

describe("SNARC loop adapter", () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), "magra-snarc-loop-"));
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it("captures post-tool results without changing the tool result path", async () => {
    // === START_BLOCK_ASSERT_POST_TOOL_CAPTURE ===
    const adapter = createSnarcLoopAdapter();
    const result = await adapter.onPostToolUse({
      rootDir,
      sessionId: "loop-1",
      toolName: "run_command",
      toolArgs: { command: "npm test -- tests/snarc-loop-adapter.test.ts" },
      toolResult: "PASS tests/snarc-loop-adapter.test.ts completed successfully",
    });

    expect(result.captured).toBe(true);
    expect(result.logMarker).toBe("[SnarcLoopAdapter][onPostToolUse][BLOCK_CAPTURE_TOOL]");
    expect(searchMemory("loop adapter test", { rootDir })).toHaveLength(1);
    // === END_BLOCK_ASSERT_POST_TOOL_CAPTURE ===
  });

  it("injects relevant memory for prompt events and captures the submitted prompt", async () => {
    // === START_BLOCK_ASSERT_PROMPT_INJECTION ===
    captureObservation({
      rootDir,
      sessionId: "loop-2",
      toolName: "run_command",
      input: "debug src/snarc/loop-adapter.ts",
      output: "PASS after fixing SNARC prompt injection",
    });

    const adapter = createSnarcLoopAdapter();
    const additional = await adapter.onUserPromptSubmit({
      rootDir,
      sessionId: "loop-2",
      prompt: "continue SNARC prompt injection work",
      turn: 7,
    });

    expect(additional.logMarker).toBe(
      "[SnarcLoopAdapter][onUserPromptSubmit][BLOCK_INJECT_MEMORY]",
    );
    expect(additional.context).toContain("<snarc_memory_context>");
    expect(additional.context).toContain("[observed");
    expect(additional.captured?.captured).toBe(true);
    // === END_BLOCK_ASSERT_PROMPT_INJECTION ===
  });

  it("captures conversation state before compaction", async () => {
    // === START_BLOCK_ASSERT_PRE_COMPACT_CAPTURE ===
    const adapter = createSnarcLoopAdapter();
    const result = await adapter.onPreCompact({
      rootDir,
      sessionId: "loop-3",
      reason: "context guard",
      messages: [
        { role: "user", content: "Investigate SNARC compaction capture" },
        { role: "assistant", content: "Captured important MAGRA context before folding." },
      ],
    });

    expect(result.logMarker).toBe("[SnarcLoopAdapter][onPreCompact][BLOCK_CAPTURE_CONVERSATION]");
    expect(result.captured).toBe(true);
    expect(searchMemory("compaction capture", { rootDir })).toHaveLength(1);
    // === END_BLOCK_ASSERT_PRE_COMPACT_CAPTURE ===
  });

  it("keeps adapter failures bounded and consolidates on stop when memory works", async () => {
    // === START_BLOCK_ASSERT_FAILURE_ISOLATION_AND_STOP ===
    const broken = createSnarcLoopAdapter({
      memory: {
        captureObservation: () => {
          throw new Error("storage unavailable");
        },
      },
    });

    const capture = await broken.onPostToolUse({
      rootDir,
      sessionId: "loop-4",
      toolName: "run_command",
      toolArgs: "npm test",
      toolResult: "PASS",
    });
    expect(capture.captured).toBe(false);
    expect(capture.logMarker).toBe("[SnarcLoopAdapter][onPostToolUse][BLOCK_CAPTURE_TOOL]");

    const adapter = createSnarcLoopAdapter();
    await adapter.onPostToolUse({
      rootDir,
      sessionId: "loop-5",
      toolName: "run_command",
      toolArgs: "npm test src/snarc/loop-adapter.ts",
      toolResult: "PASS src/snarc/loop-adapter.ts completed successfully",
    });
    const stop = await adapter.onStop({ rootDir, sessionId: "loop-5", deepDream: true });
    expect(stop.consolidated).toBe(true);
    expect(stop.warnings).toContain(
      "SNARC deep dream is optional in MAGRA and is not run without an explicit model client.",
    );
    // === END_BLOCK_ASSERT_FAILURE_ISOLATION_AND_STOP ===
  });
});
