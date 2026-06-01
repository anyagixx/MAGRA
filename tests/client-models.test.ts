import { describe, expect, it, vi } from "vitest";
import { DeepSeekClient } from "../src/client.js";

function makeFetch(status: number, body: unknown) {
  return vi.fn(
    async () =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  ) as unknown as typeof fetch;
}

describe("DeepSeekClient.listModels", () => {
  it("parses OpenAI-style model list", async () => {
    const client = new DeepSeekClient({
      apiKey: "sk-test",
      fetch: makeFetch(200, {
        object: "list",
        data: [
          { id: "deepseek-chat", object: "model", owned_by: "deepseek" },
          { id: "deepseek-reasoner", object: "model", owned_by: "deepseek" },
        ],
      }),
    });
    const list = await client.listModels();
    expect(list).not.toBeNull();
    expect(list!.data.map((m) => m.id)).toEqual(["deepseek-chat", "deepseek-reasoner"]);
  });

  it("returns null on non-2xx", async () => {
    const client = new DeepSeekClient({
      apiKey: "sk-bad",
      fetch: makeFetch(401, { error: "unauthorized" }),
    });
    expect(await client.listModels()).toBeNull();
  });

  it("returns null on malformed payload", async () => {
    const client = new DeepSeekClient({
      apiKey: "sk-test",
      fetch: makeFetch(200, { whatever: "not a list" }),
    });
    expect(await client.listModels()).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    const client = new DeepSeekClient({
      apiKey: "sk-test",
      fetch: vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }) as unknown as typeof fetch,
    });
    expect(await client.listModels()).toBeNull();
  });

  it("sends bearer token header", async () => {
    const spy = vi.fn(
      async () =>
        new Response(JSON.stringify({ object: "list", data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const client = new DeepSeekClient({
      apiKey: "sk-xyz",
      fetch: spy as unknown as typeof fetch,
    });
    await client.listModels();
    const [, init] = spy.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("GET");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-xyz");
  });
  it("caches explicit image capability metadata from model list", async () => {
    const client = new DeepSeekClient({
      apiKey: "sk-test",
      baseUrl: "https://api.deepseek.com",
      fetch: makeFetch(200, {
        object: "list",
        data: [
          {
            id: "deepseek-chat",
            object: "model",
            owned_by: "deepseek",
            capabilities: { input_modalities: ["text"] },
          },
          {
            id: "vision-pro",
            object: "model",
            owned_by: "deepseek",
            capabilities: { input_modalities: ["text", "image"] },
          },
        ],
      }),
    });

    expect(client.supportsImageInput("deepseek-chat")).toBe(false);
    expect(client.supportsImageInput("vision-pro")).toBe(true);

    const list = await client.listModels();
    expect(list).not.toBeNull();
    expect(client.supportsImageInput("deepseek-chat")).toBe(false);
    expect(client.supportsImageInput("vision-pro")).toBe(true);
  });

  it("honors explicit non-image capability metadata over heuristic-looking model ids", async () => {
    const client = new DeepSeekClient({
      apiKey: "sk-test",
      baseUrl: "https://api.openai.com/v1",
      fetch: makeFetch(200, {
        object: "list",
        data: [
          {
            id: "gpt-4o-mini",
            object: "model",
            owned_by: "openai",
            capabilities: { input_modalities: ["text"] },
          },
        ],
      }),
    });

    expect(client.supportsImageInput("gpt-4o-mini")).toBe(true);
    await client.listModels();
    expect(client.supportsImageInput("gpt-4o-mini")).toBe(false);
  });
});

describe("DeepSeekClient rateLimit", () => {
  it("waits between chat requests when rpm configured", async () => {
    vi.useFakeTimers();
    const spy = vi.fn(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const client = new DeepSeekClient({
      apiKey: "sk-test",
      fetch: spy as unknown as typeof fetch,
      rateLimit: { rpm: 30 },
    });
    try {
      await client.chat({ model: "deepseek-chat", messages: [] });
      const second = client.chat({ model: "deepseek-chat", messages: [] });
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1999);
      expect(spy).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await second;
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("DeepSeekClient usage parsing", () => {
  it("parses Ollama native top-level token metrics", async () => {
    const client = new DeepSeekClient({
      apiKey: "ollama",
      fetch: makeFetch(200, {
        model: "gpt-oss:20b",
        message: { role: "assistant", content: "ok" },
        done: true,
        prompt_eval_count: 42,
        eval_count: 7,
      }),
    });
    const resp = await client.chat({ model: "gpt-oss:20b", messages: [] });
    expect(resp.usage.promptTokens).toBe(42);
    expect(resp.usage.completionTokens).toBe(7);
    expect(resp.usage.totalTokens).toBe(49);
    expect(resp.usage.promptCacheMissTokens).toBe(42);
  });

  it("requests usage metadata for streaming calls", async () => {
    let body: { stream_options?: unknown } | null = null;
    const fetch = vi.fn(async (_url, init) => {
      body = JSON.parse(String((init as RequestInit).body)) as { stream_options?: unknown };
      const frames = [
        `data: ${JSON.stringify({ choices: [{ delta: { content: "ok" } }] })}\n\n`,
        `data: ${JSON.stringify({ choices: [{ finish_reason: "stop", delta: {} }], usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 } })}\n\n`,
        "data: [DONE]\n\n",
      ];
      const stream = new ReadableStream({
        start(controller) {
          for (const frame of frames) controller.enqueue(new TextEncoder().encode(frame));
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }) as unknown as typeof globalThis.fetch;
    const client = new DeepSeekClient({ apiKey: "sk-test", fetch });

    const chunks = [];
    for await (const chunk of client.stream({
      model: "deepseek-chat",
      messages: [{ role: "user", content: "hi" }],
    })) {
      chunks.push(chunk);
    }

    expect(body?.stream_options).toEqual({ include_usage: true });
    expect(chunks.at(-1)?.usage?.promptTokens).toBe(10);
    expect(chunks.at(-1)?.usage?.promptCacheMissTokens).toBe(10);
  });
});

describe("DeepSeekClient request serialization", () => {
  it("maps image attachments into OpenAI-style image_url parts for image-capable routes", async () => {
    let sentBody = "";
    const spy = vi.fn(async (_url: unknown, init: unknown) => {
      sentBody = String((init as RequestInit).body ?? "");
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const client = new DeepSeekClient({
      apiKey: "sk-test",
      baseUrl: "https://api.openai.com/v1",
      fetch: spy as unknown as typeof fetch,
    });

    await client.chat({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: "what is in this screenshot?",
          attachments: [
            {
              id: "img-1",
              kind: "image",
              name: "shot.png",
              path: "shot.png",
              size: 12,
              mimeType: "image/png",
              dataUrl: "data:image/png;base64,AAAA",
            },
          ],
        },
      ],
    });

    expect(JSON.parse(sentBody).messages[0].content).toEqual([
      { type: "text", text: "what is in this screenshot?" },
      { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
    ]);
  });

  it("degrades image attachments to text-only content on non-image-capable routes", async () => {
    let sentBody = "";
    const spy = vi.fn(async (_url: unknown, init: unknown) => {
      sentBody = String((init as RequestInit).body ?? "");
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const client = new DeepSeekClient({
      apiKey: "sk-test",
      fetch: spy as unknown as typeof fetch,
    });

    await client.chat({
      model: "deepseek-chat",
      messages: [
        {
          role: "user",
          content: "what is in this screenshot?",
          attachments: [
            {
              id: "img-1",
              kind: "image",
              name: "shot.png",
              path: "shot.png",
              size: 12,
              mimeType: "image/png",
              dataUrl: "data:image/png;base64,AAAA",
            },
          ],
        },
      ],
    });

    expect(JSON.parse(sentBody).messages[0].content).toBe("what is in this screenshot?");
  });

  it("keeps file attachment excerpts as plain text content", async () => {
    let sentBody = "";
    const spy = vi.fn(async (_url: unknown, init: unknown) => {
      sentBody = String((init as RequestInit).body ?? "");
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const client = new DeepSeekClient({
      apiKey: "sk-test",
      fetch: spy as unknown as typeof fetch,
    });

    await client.chat({
      model: "deepseek-chat",
      messages: [
        {
          role: "user",
          content: "review attached file",
          attachments: [
            {
              id: "file-1",
              kind: "file",
              name: "README.md",
              path: "README.md",
              size: 42,
              excerpt: "# MAGRA",
            },
          ],
        },
      ],
    });

    expect(JSON.parse(sentBody).messages[0].content).toContain("[Attached file: README.md]");
    expect(JSON.parse(sentBody).messages[0].content).toContain("# MAGRA");
  });

  it("strips local attachment metadata before sending API payload", async () => {
    let sentBody = "";
    const spy = vi.fn(async (_url: unknown, init: unknown) => {
      sentBody = String((init as RequestInit).body ?? "");
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const client = new DeepSeekClient({
      apiKey: "sk-test",
      fetch: spy as unknown as typeof fetch,
    });

    await client.chat({
      model: "deepseek-chat",
      messages: [
        {
          role: "user",
          content: "inspect attachment",
          attachments: [
            {
              id: "att-1",
              kind: "file",
              name: "README.md",
              path: "README.md",
              size: 42,
              excerpt: "# MAGRA",
            },
          ],
        },
      ],
    });

    expect(JSON.parse(sentBody).messages[0].attachments).toBeUndefined();
  });

  it("replaces lone UTF-16 surrogates before sending JSON", async () => {
    let sentBody = "";
    const spy = vi.fn(async (_url: unknown, init: unknown) => {
      sentBody = String((init as RequestInit).body ?? "");
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const client = new DeepSeekClient({
      apiKey: "sk-test",
      fetch: spy as unknown as typeof fetch,
    });

    await client.chat({
      model: "deepseek-chat",
      messages: [{ role: "user", content: `bad ${String.fromCharCode(0xd800)} text` }],
    });

    expect(sentBody).not.toMatch(/\\ud[89ab][0-9a-f]{2}/i);
    expect(JSON.parse(sentBody).messages[0].content).toBe("bad \uFFFD text");
  });
});
