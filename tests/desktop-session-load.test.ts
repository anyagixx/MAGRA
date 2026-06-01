// === CHANGE_SUMMARY ===
// Added replay coverage for persisted user attachments in loaded desktop sessions.
// Fixed transient image data URL replay assertion to match persistence contract.
// === END_CHANGE_SUMMARY ===

import { describe, expect, it } from "vitest";
import * as desktopCommand from "../src/cli/commands/desktop.js";
import type { ChatMessage } from "../src/types.js";

type BuildLoadedMessages = (records: ChatMessage[]) => Array<{
  kind: "assistant" | "user";
  attachments?: Array<{ name: string; kind: "file" | "image"; dataUrl?: string }>;
  segments?: Array<{ kind: string; text?: string; args?: string; result?: string }>;
}>;

describe("desktop session loading", () => {
  it("elides old heavy assistant segments before sending $session_loaded", () => {
    const buildLoadedMessages = (desktopCommand as { buildLoadedMessages?: BuildLoadedMessages })
      .buildLoadedMessages;
    expect(typeof buildLoadedMessages).toBe("function");

    const huge = "desktop retained field\n".repeat(900);
    const records: ChatMessage[] = [];
    for (let i = 0; i < 260; i++) {
      records.push({
        role: "assistant",
        content: huge,
        reasoning_content: huge,
        tool_calls: [
          {
            id: `c-${i}`,
            type: "function",
            function: {
              name: "write_file",
              arguments: JSON.stringify({ path: `file-${i}.txt`, content: huge }),
            },
          },
        ],
      });
      records.push({ role: "tool", tool_call_id: `c-${i}`, content: huge });
    }

    const loaded = buildLoadedMessages!(records);
    const firstAssistant = loaded.find((m) => m.kind === "assistant");
    expect(firstAssistant).toBeDefined();
    const reasoning = firstAssistant!.segments!.find((s) => s.kind === "reasoning");
    const text = firstAssistant!.segments!.find((s) => s.kind === "text");
    const tool = firstAssistant!.segments!.find((s) => s.kind === "tool");

    expect(reasoning?.text?.length).toBeLessThan(huge.length / 10);
    expect(text?.text?.length).toBeLessThan(huge.length / 10);
    expect(tool?.args?.length).toBeLessThan(huge.length / 10);
    expect(tool?.result?.length).toBeLessThan(huge.length / 10);
  });

  it("preserves user attachments in loaded session messages", () => {
    const buildLoadedMessages = (desktopCommand as { buildLoadedMessages?: BuildLoadedMessages })
      .buildLoadedMessages;
    expect(typeof buildLoadedMessages).toBe("function");

    const loaded = buildLoadedMessages!([
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
          },
        ],
      },
    ]);

    expect(loaded[0]).toMatchObject({
      kind: "user",
      text: "inspect attachment",
      attachments: [{ name: "README.md", kind: "file" }],
    });
  });

  it("omits transient image data urls from loaded session messages", () => {
    const buildLoadedMessages = (desktopCommand as { buildLoadedMessages?: BuildLoadedMessages })
      .buildLoadedMessages;
    expect(typeof buildLoadedMessages).toBe("function");

    const loaded = buildLoadedMessages!([
      {
        role: "user",
        content: "inspect image",
        attachments: [
          {
            id: "img-1",
            kind: "image",
            name: "shot.png",
            path: "shot.png",
            size: 12,
          },
        ],
      },
    ]);

    expect(loaded[0]).toMatchObject({
      kind: "user",
      text: "inspect image",
      attachments: [{ name: "shot.png", kind: "image" }],
    });
    expect(loaded[0].attachments?.[0]?.dataUrl).toBeUndefined();
  });
});
