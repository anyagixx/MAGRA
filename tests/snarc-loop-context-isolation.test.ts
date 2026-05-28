// === MODULE_CONTRACT ===
// FILE: tests/snarc-loop-context-isolation.test.ts
// VERSION: 1.0.0
// PURPOSE: Verify MAGRA keeps SNARC injected memory as transient model-only context.
// SCOPE: Loop prompt assembly, session persistence, in-memory transcript, and pre-compaction capture.
// DEPENDS: M-SNARC-CONTEXT-ISOLATION,M-SNARC-LOOP-ADAPTER
// LINKS: docs/verification/V-M-SNARC-CONTEXT-ISOLATION.xml
// ROLE: TEST
// MAP_MODE: LOCALS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: createClient, createRecordingSnarcAdapter, blankScore, SNARC context isolation assertions
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Added runtime regression coverage for model-only SNARC memory context.
// === END_CHANGE_SUMMARY ===

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeepSeekClient } from "../src/client.js";
import { CacheFirstLoop } from "../src/loop.js";
import { ImmutablePrefix } from "../src/memory/runtime.js";
import { loadSessionMessages } from "../src/memory/session.js";
import type { SnarcLoopAdapter } from "../src/snarc/loop-adapter.js";
import type { SnarcScores } from "../src/snarc/memory.js";
import type { ChatMessage } from "../src/types.js";

const SNARC_CONTEXT = "<snarc_memory_context>\nsecret relevant memory\n</snarc_memory_context>";

const blankScore: SnarcScores = {
  surprise: 0,
  novelty: 0,
  arousal: 0,
  reward: 0,
  conflict: 0,
  salience: 0,
};

function createClient(requestMessages: ChatMessage[][]): DeepSeekClient {
  return new DeepSeekClient({
    apiKey: "sk-test",
    fetch: vi.fn(async (_url: unknown, init: { body?: string } | undefined) => {
      const body = init?.body ? JSON.parse(init.body) : {};
      requestMessages.push(body.messages as ChatMessage[]);
      return new Response(
        JSON.stringify({
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "ok" },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch,
  });
}

function createRecordingSnarcAdapter(
  promptInputs: string[],
  preCompactMessages: ChatMessage[][],
): SnarcLoopAdapter {
  return {
    async onUserPromptSubmit(payload) {
      promptInputs.push(payload.prompt);
      return {
        context: SNARC_CONTEXT,
        warnings: [],
        results: [],
        captured: {
          captured: true,
          score: blankScore,
          reason: "test prompt capture",
          logMarker: "[SnarcLoopAdapter][onUserPromptSubmit][BLOCK_INJECT_MEMORY]",
        },
        logMarker: "[SnarcLoopAdapter][onUserPromptSubmit][BLOCK_INJECT_MEMORY]",
      };
    },
    async onPostToolUse() {
      return {
        captured: false,
        score: blankScore,
        reason: "no tool capture in test",
        logMarker: "[SnarcLoopAdapter][onPostToolUse][BLOCK_CAPTURE_TOOL]",
      };
    },
    async onPreCompact(payload) {
      preCompactMessages.push(payload.messages.map((message) => ({ ...(message as ChatMessage) })));
      return {
        captured: true,
        warnings: [],
        capture: {
          captured: true,
          score: blankScore,
          reason: "test pre-compact capture",
          logMarker: "[SnarcLoopAdapter][onPreCompact][BLOCK_CAPTURE_CONVERSATION]",
        },
        logMarker: "[SnarcLoopAdapter][onPreCompact][BLOCK_CAPTURE_CONVERSATION]",
      };
    },
    async onStop() {
      return {
        consolidated: false,
        warnings: [],
        logMarker: "[SnarcLoopAdapter][onStop][BLOCK_CONSOLIDATE_STOP]",
      };
    },
  };
}

describe("SNARC loop context isolation", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "magra-snarc-context-"));
    vi.stubEnv("USERPROFILE", tmp);
    vi.stubEnv("HOME", tmp);
    vi.spyOn(require("node:os"), "homedir").mockReturnValue(tmp);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
  });

  it("sends SNARC memory to the model without persisting it as user transcript text", async () => {
    // === START_BLOCK_ASSERT_MODEL_ONLY_CONTEXT ===
    const requestMessages: ChatMessage[][] = [];
    const promptInputs: string[] = [];
    const preCompactMessages: ChatMessage[][] = [];
    const sessionName = "snarc-context-model-only";
    const loop = new CacheFirstLoop({
      client: createClient(requestMessages),
      prefix: new ImmutablePrefix({ system: "s" }),
      stream: false,
      session: sessionName,
      snarc: createRecordingSnarcAdapter(promptInputs, preCompactMessages),
    });

    await loop.run("build the MAGRA skill bridge");

    const sentUserMessages = requestMessages[0]!.filter((message) => message.role === "user");
    expect(sentUserMessages.map((message) => message.content)).toEqual([
      `build the MAGRA skill bridge\n\n${SNARC_CONTEXT}`,
    ]);
    expect(promptInputs).toEqual(["build the MAGRA skill bridge"]);

    const persisted = loadSessionMessages(sessionName);
    expect(
      persisted.filter((message) => message.role === "user").map((message) => message.content),
    ).toEqual(["build the MAGRA skill bridge"]);
    expect(JSON.stringify(persisted)).not.toContain("snarc_memory_context");
    expect(JSON.stringify(loop.log.entries)).not.toContain("snarc_memory_context");
    // === END_BLOCK_ASSERT_MODEL_ONLY_CONTEXT ===
  });

  it("keeps pre-compaction capture free of injected SNARC memory context", async () => {
    // === START_BLOCK_ASSERT_COMPACTION_CONTEXT_ISOLATION ===
    const requestMessages: ChatMessage[][] = [];
    const promptInputs: string[] = [];
    const preCompactMessages: ChatMessage[][] = [];
    const loop = new CacheFirstLoop({
      client: createClient(requestMessages),
      prefix: new ImmutablePrefix({ system: "s" }),
      stream: false,
      session: "snarc-context-compact",
      snarc: createRecordingSnarcAdapter(promptInputs, preCompactMessages),
    });

    await loop.run("summarize the SNARC isolation work");
    await loop.compactHistory({ keepRecentTokens: 10_000 });

    expect(preCompactMessages).toHaveLength(1);
    expect(
      preCompactMessages[0]!
        .filter((message) => message.role === "user")
        .map((message) => message.content),
    ).toEqual(["summarize the SNARC isolation work"]);
    expect(JSON.stringify(preCompactMessages[0])).not.toContain("snarc_memory_context");
    // === END_BLOCK_ASSERT_COMPACTION_CONTEXT_ISOLATION ===
  });
});
