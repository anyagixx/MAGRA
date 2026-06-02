import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type EventSourceInstance = {
  url: string;
  onmessage: ((msg: MessageEvent) => void) | null;
  onerror: (() => void) | null;
  close: () => void;
};

const settingsResponse = {
  reasoningEffort: "high",
  editMode: "review",
  budgetUsd: null,
  model: "deepseek-v4-pro",
  webSearchEngine: "bing",
  subagentModels: {},
  baseUrl: "",
  apiKey: "",
};

function jsonResponse(body: unknown): Response {
  return {
    status: 200,
    text: async () => JSON.stringify(body),
  } as Response;
}

async function loadBridge(options?: {
  overview?: Record<string, unknown>;
  sessions?: Record<string, unknown>;
}) {
  vi.resetModules();

  let overview = options?.overview ?? {
    cwd: "E:/proj",
    model: "deepseek-v4-pro",
    version: "0.52.0",
    stats: {
      totalCostUsd: 0.123456,
      cacheHitRatio: 0.75,
      lastPromptTokens: 1200,
      cacheHitTokens: 900,
      cacheMissTokens: 300,
      totalCompletionTokens: 150,
      balance: [{ currency: "CNY", total_balance: "88.5" }],
    },
  };
  let sessions = options?.sessions ?? {
    currentSession: "code-20260526120000",
    sessions: [
      {
        name: "code-20260526120000",
        messageCount: 4,
        mtime: Date.UTC(2026, 4, 26, 12, 0, 0),
        summary: "fresh session",
      },
    ],
  };

  vi.stubGlobal("document", {
    documentElement: { dataset: {} },
    querySelector: (selector: string) => {
      if (selector === 'meta[name="reasonix-mode"]') {
        return { getAttribute: () => "server" };
      }
      if (selector === 'meta[name="reasonix-token"]') {
        return { getAttribute: () => "testtoken" };
      }
      return null;
    },
  });

  const eventSources: EventSourceInstance[] = [];
  class FakeEventSource {
    onmessage: ((msg: MessageEvent) => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public url: string) {
      eventSources.push(this);
    }
    close() {}
  }
  vi.stubGlobal("EventSource", FakeEventSource);

  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes("/api/settings")) return jsonResponse(settingsResponse);
    if (url.includes("/api/sessions")) return jsonResponse(sessions);
    if (url.includes("/api/overview")) return jsonResponse(overview);
    return jsonResponse({});
  });
  vi.stubGlobal("fetch", fetchMock);

  const bridge = await import("../dashboard/src/lib/tauri-bridge");
  const events: Record<string, any>[] = [];
  await bridge.listen("rpc:event", (event) => {
    events.push(JSON.parse(event.payload.data));
  });
  await bridge.invoke("rpc_spawn");
  await vi.waitFor(() => expect(events.some((event) => event.type === "$ready")).toBe(true));

  return {
    bridge,
    events,
    fetchMock,
    eventSources,
    setOverview: (next: Record<string, unknown>) => {
      overview = next;
    },
    setSessions: (next: Record<string, unknown>) => {
      sessions = next;
    },
  };
}

describe("dashboard server bridge refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("emits the current server session in the session snapshot", async () => {
    const { events } = await loadBridge();

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "$sessions",
        currentSession: "code-20260526120000",
        items: [
          expect.objectContaining({
            name: "code-20260526120000",
            messageCount: 4,
            summary: "fresh session",
          }),
        ],
      }),
    );
  });

  it("emits absolute usage stats from overview so the token counter can recover after reconnect", async () => {
    const { events } = await loadBridge();

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "$session_usage",
        totalCostUsd: 0.123456,
        totalPromptTokens: 1200,
        totalCompletionTokens: 150,
        cacheHitTokens: 900,
        cacheMissTokens: 300,
      }),
    );
  });

  it("polls snapshots so sessions created outside the open page appear without reload", async () => {
    const { events, setOverview, setSessions } = await loadBridge();
    events.length = 0;

    setSessions({
      currentSession: "code-20260526120500",
      sessions: [
        {
          name: "code-20260526120500",
          messageCount: 2,
          mtime: Date.UTC(2026, 4, 26, 12, 5, 0),
          summary: "new external session",
        },
      ],
    });
    setOverview({
      cwd: "E:/proj",
      model: "deepseek-v4-pro",
      version: "0.52.0",
      stats: {
        totalCostUsd: 0.2,
        cacheHitTokens: 1600,
        cacheMissTokens: 400,
        totalCompletionTokens: 250,
        balance: [{ currency: "CNY", total_balance: "91" }],
      },
    });

    await vi.advanceTimersByTimeAsync(5000);

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "$sessions",
        currentSession: "code-20260526120500",
        items: [expect.objectContaining({ name: "code-20260526120500" })],
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "$session_usage",
        totalPromptTokens: 2000,
        totalCompletionTokens: 250,
      }),
    );
  });

  it("forwards attachment payloads through submit RPC", async () => {
    const { bridge, fetchMock } = await loadBridge();
    await bridge.invoke("rpc_send", {
      line: JSON.stringify({
        cmd: "user_input",
        text: "inspect attachment",
        attachments: [
          {
            id: "att-1",
            kind: "file",
            name: "README.md",
            path: "README.md",
            size: 42,
            excerpt: "# MAGRA",
            relativeToWorkspace: true,
          },
        ],
      }),
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/submit"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          prompt: "inspect attachment",
          attachments: [
            {
              id: "att-1",
              kind: "file",
              name: "README.md",
              path: "README.md",
              size: 42,
              excerpt: "# MAGRA",
              relativeToWorkspace: true,
            },
          ],
        }),
      }),
    );
  });

  it("surfaces submit API error bodies instead of generic retry text", async () => {
    const { bridge, events, fetchMock } = await loadBridge();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/api/settings")) return jsonResponse(settingsResponse);
      if (url.includes("/api/sessions")) return jsonResponse({ currentSession: "", sessions: [] });
      if (url.includes("/api/overview")) return jsonResponse({ cwd: "E:/proj", stats: {} });
      if (url.includes("/api/submit")) {
        return {
          status: 413,
          text: async () => JSON.stringify({ error: "body exceeds 33554432 bytes" }),
        } as Response;
      }
      return jsonResponse({});
    });
    events.length = 0;

    await bridge.invoke("rpc_send", {
      line: JSON.stringify({
        cmd: "user_input",
        text: "inspect screenshot",
        attachments: [
          {
            id: "att-image-1",
            kind: "image",
            name: "screenshot.png",
            path: "screenshot.png",
            size: 40_000_000,
            dataUrl: "data:image/png;base64,AAAA",
          },
        ],
      }),
    });

    await vi.waitFor(() =>
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "$error",
          message: "body exceeds 33554432 bytes",
        }),
      ),
    );
  });

  it("surfaces MyGRACE skill run API errors instead of swallowing them", async () => {
    const { bridge, events, fetchMock } = await loadBridge();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/api/settings")) return jsonResponse(settingsResponse);
      if (url.includes("/api/sessions")) return jsonResponse({ currentSession: "", sessions: [] });
      if (url.includes("/api/overview")) return jsonResponse({ cwd: "E:/proj", stats: {} });
      if (url.includes("/api/skills/run")) {
        return {
          status: 409,
          text: async () => JSON.stringify({ accepted: false, reason: "loop is busy" }),
        } as Response;
      }
      return jsonResponse({});
    });
    events.length = 0;

    await bridge.invoke("rpc_send", {
      line: JSON.stringify({ cmd: "mygrace_skill_run", command: "/mygrace:init" }),
    });

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "$error",
        message: "mygrace_skill_run: loop is busy",
      }),
    );
  });
});
