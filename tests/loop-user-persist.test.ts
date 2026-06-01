import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeepSeekClient } from "../src/client.js";
import { CacheFirstLoop } from "../src/loop.js";
import { ImmutablePrefix } from "../src/memory/runtime.js";
import { loadSessionMessages } from "../src/memory/session.js";
import type { ChatMessage } from "../src/types.js";

describe("loop persists user message at step entry (issue #943)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "reasonix-loop943-"));
    vi.stubEnv("USERPROFILE", tmp);
    vi.stubEnv("HOME", tmp);
    vi.spyOn(require("node:os"), "homedir").mockReturnValue(tmp);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
  });

  it("writes user message to session log before first API call settles, so mid-stream abort doesn't drop it", async () => {
    const client = new DeepSeekClient({
      apiKey: "sk-test",
      fetch: vi.fn(async (_url: unknown, init: { signal?: AbortSignal } | undefined) => {
        const signal = init?.signal;
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener("abort", () =>
            reject(new DOMException("This operation was aborted", "AbortError")),
          );
        });
      }) as unknown as typeof fetch,
      retry: { maxAttempts: 1 },
    });

    const sessionName = "bug943-pre-response-abort";
    const loop = new CacheFirstLoop({
      client,
      prefix: new ImmutablePrefix({ system: "s" }),
      stream: false,
      session: sessionName,
    });

    const consumed = (async () => {
      for await (const ev of loop.step("hello — switching away soon")) {
        if (ev.role === "done") break;
      }
    })();

    await new Promise((r) => setTimeout(r, 10));
    loop.abort();
    await consumed;

    const persisted = loadSessionMessages(sessionName);
    const firstUser = persisted.find((m) => m.role === "user");
    expect(firstUser).toBeDefined();
    expect(firstUser?.content).toBe("hello — switching away soon");
  });

  it("writes user message immediately even when API call succeeds normally", async () => {
    const client = new DeepSeekClient({
      apiKey: "sk-test",
      fetch: vi.fn(async () => {
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

    const sessionName = "bug943-happy-path";
    const loop = new CacheFirstLoop({
      client,
      prefix: new ImmutablePrefix({ system: "s" }),
      stream: false,
      session: sessionName,
    });

    for await (const ev of loop.step("happy path")) {
      if (ev.role === "done") break;
    }

    const persisted = loadSessionMessages(sessionName);
    expect(persisted[0]).toEqual({ role: "user", content: "happy path" });
    expect(persisted.length).toBeGreaterThanOrEqual(2);
    expect(persisted.some((m) => m.role === "assistant")).toBe(true);
    const userMsgs = persisted.filter((m) => m.role === "user");
    expect(userMsgs).toHaveLength(1);
  });

  it("persists send-time healing of dangling tool_calls so session does not stay poisoned", async () => {
    const requestMessages: ChatMessage[][] = [];
    const client = new DeepSeekClient({
      apiKey: "sk-test",
      fetch: vi.fn(async (_url: unknown, init: { body?: string } | undefined) => {
        const body = init?.body ? JSON.parse(init.body) : {};
        requestMessages.push(body.messages as ChatMessage[]);
        return new Response(
          JSON.stringify({
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: "recovered" },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as unknown as typeof fetch,
    });

    const sessionName = "issue1079-dangling-tool-heal";
    const loop = new CacheFirstLoop({
      client,
      prefix: new ImmutablePrefix({ system: "s" }),
      stream: false,
      session: sessionName,
    });
    loop.appendAndPersist({ role: "user", content: "before sleep" });
    loop.appendAndPersist({
      role: "assistant",
      content: "",
      tool_calls: [{ id: "lost", type: "function", function: { name: "read", arguments: "{}" } }],
    });

    await loop.run("continue after wake");

    expect(
      requestMessages[0]!.some((m) => m.role === "assistant" && (m.tool_calls?.length ?? 0) > 0),
    ).toBe(false);
    expect(
      loop.log.entries.some((m) => m.role === "assistant" && (m.tool_calls?.length ?? 0) > 0),
    ).toBe(false);
    expect(
      loadSessionMessages(sessionName).some(
        (m) => m.role === "assistant" && (m.tool_calls?.length ?? 0) > 0,
      ),
    ).toBe(false);
  });

  it("can discard explicitly aborted prompt before next request (#1593)", async () => {
    const requestMessages: ChatMessage[][] = [];
    let callCount = 0;
    const client = new DeepSeekClient({
      apiKey: "sk-test",
      fetch: vi.fn(
        async (_url: unknown, init: { body?: string; signal?: AbortSignal } | undefined) => {
          const body = init?.body ? JSON.parse(init.body) : {};
          requestMessages.push(body.messages as ChatMessage[]);
          if (callCount++ === 0) {
            return new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () =>
                reject(new DOMException("This operation was aborted", "AbortError")),
              );
            });
          }
          return new Response(
            JSON.stringify({
              choices: [
                {
                  index: 0,
                  message: { role: "assistant", content: "rewritten" },
                  finish_reason: "stop",
                },
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        },
      ) as unknown as typeof fetch,
      retry: { maxAttempts: 1 },
    });

    const sessionName = "bug1593-discard-explicit-abort";
    const loop = new CacheFirstLoop({
      client,
      prefix: new ImmutablePrefix({ system: "s" }),
      stream: false,
      session: sessionName,
    });

    const interrupted = (async () => {
      for await (const ev of loop.step("完全重写这段一万字符结构化文本")) {
        if (ev.role === "done") break;
      }
    })();

    await new Promise((r) => setTimeout(r, 10));
    loop.abort({ discardCurrentTurn: true });
    await interrupted;

    await loop.run("请按这次要求完整重写，不要局部微调");

    const secondRequestUsers = requestMessages[1]!
      .filter((m) => m.role === "user")
      .map((m) => m.content);
    expect(secondRequestUsers).toEqual(["请按这次要求完整重写，不要局部微调"]);
    expect(loadSessionMessages(sessionName).filter((m) => m.role === "user")).toHaveLength(1);
  });

  it("emits visible warning when image attachments downgrade to text-only route", async () => {
    const client = new DeepSeekClient({
      apiKey: "sk-test",
      fetch: vi.fn(async () => {
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

    const loop = new CacheFirstLoop({
      client,
      prefix: new ImmutablePrefix({ system: "s" }),
      model: "deepseek-chat",
      stream: false,
      session: "waveb-image-warning",
    });

    const events = [] as Array<{ role: string; content: string }>;
    for await (const ev of loop.step("inspect image", [
      {
        id: "img-1",
        kind: "image",
        name: "shot.png",
        path: "shot.png",
        size: 12,
        dataUrl: "data:image/png;base64,AAAA",
      },
    ])) {
      events.push({ role: ev.role, content: ev.content });
      if (ev.role === "done") break;
    }

    expect(
      events.some((ev) => ev.role === "warning" && ev.content.includes("IMAGE_SEND_GATING")),
    ).toBe(true);
  });

  it("persists image attachments without embedding transient data urls in session JSONL", async () => {
    const client = new DeepSeekClient({
      apiKey: "sk-test",
      fetch: vi.fn(async () => {
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

    const sessionName = "waveb-image-persist";
    const loop = new CacheFirstLoop({
      client,
      prefix: new ImmutablePrefix({ system: "s" }),
      stream: false,
      session: sessionName,
    });

    for await (const ev of loop.step("inspect image", [
      {
        id: "img-1",
        kind: "image",
        name: "shot.png",
        path: "shot.png",
        size: 12,
        dataUrl: "data:image/png;base64,AAAA",
        preview: "data:image/png;base64,AAAA",
      },
    ])) {
      if (ev.role === "done") break;
    }

    const persisted = loadSessionMessages(sessionName);
    const firstUser = persisted.find((m) => m.role === "user");
    expect(firstUser?.attachments?.[0]?.kind).toBe("image");
    expect(firstUser?.attachments?.[0]?.path).toBe("shot.png");
    expect(firstUser?.attachments?.[0]?.dataUrl).toBeUndefined();
    expect(firstUser?.attachments?.[0]?.preview).toBeUndefined();
  });
});
