// @vitest-environment jsdom
// === MODULE_CONTRACT ===
// FILE: tests/dashboard-mygrace-commands.test.tsx
// VERSION: 1.0.0
// PURPOSE: Verify MAGRA dashboard discovery and routing for MyGRACE skills.
// SCOPE: Composer slash suggestions, `/api/slash` metadata, palette actions, and responsive command labels.
// DEPENDS: M-WEB-MYGRACE-COMMANDS
// LINKS: docs/verification/V-M-WEB-MYGRACE-COMMANDS.xml
// ROLE: TEST
// MAP_MODE: LOCALS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: dashboard MyGRACE command assertions
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial verification for MAGRA web MyGRACE command invocation.
// === END_CHANGE_SUMMARY ===

import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React, { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Composer } from "../dashboard/src/ui/composer";
import {
  WEB_MYGRACE_LOG_MARKERS,
  getMyGraceCommandPaletteActions,
  getMyGraceSlashCommands,
  submitMyGraceSlash,
} from "../dashboard/src/ui/mygrace-commands";
import { listMyGraceSkills } from "../src/mygrace/skills.js";
import { handleSlash } from "../src/server/api/slash.js";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

function renderComposerWithMyGraceSlash() {
  function Harness() {
    const [draft, setDraft] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    return (
      <Composer
        draft={draft}
        setDraft={setDraft}
        onSend={vi.fn()}
        onAbort={vi.fn()}
        modelLabel="deepseek-v4-flash"
        reasoningEffort="high"
        onModelChange={vi.fn()}
        onEffortChange={vi.fn()}
        editMode="review"
        onEditModeChange={vi.fn()}
        textareaRef={textareaRef}
        slashCommands={getMyGraceSlashCommands()}
      />
    );
  }

  render(<Harness />);
  return screen.getByPlaceholderText(/Type a prompt|输入提示词/) as HTMLTextAreaElement;
}

describe("dashboard MyGRACE commands", () => {
  it("typing /mygrace in the composer shows every MyGRACE command", () => {
    // === START_BLOCK_ASSERT_COMPOSER_DISCOVERY ===
    const textarea = renderComposerWithMyGraceSlash();

    fireEvent.change(textarea, { target: { value: "/mygrace" } });

    const expected = listMyGraceSkills().map((skill) => skill.command);
    expect(getMyGraceSlashCommands().map((command) => command.cmd)).toEqual(expected);
    for (const command of expected) {
      expect(screen.getByText(command)).toBeTruthy();
    }
    // === END_BLOCK_ASSERT_COMPOSER_DISCOVERY ===
  });

  it("/api/slash includes MyGRACE metadata only in code mode", async () => {
    // === START_BLOCK_ASSERT_API_SLASH_METADATA ===
    const codeMode = await handleSlash("GET", [], "", {
      configPath: "",
      usageLogPath: "",
      mode: "attached",
      getCurrentCwd: () => process.cwd(),
    });
    const codeBody = codeMode.body as { commands: Array<{ cmd: string; aliases?: string[] }> };
    expect(codeMode.status).toBe(200);
    expect(codeBody.commands.map((command) => command.cmd)).toContain("mygrace:status");
    expect(
      codeBody.commands.find((command) => command.cmd === "mygrace:multiagent")?.aliases,
    ).toContain("mygrace:multiagent-execute");

    const chatMode = await handleSlash("GET", [], "", {
      configPath: "",
      usageLogPath: "",
      mode: "attached",
      getCurrentCwd: () => undefined,
    });
    const chatBody = chatMode.body as { commands: Array<{ cmd: string }> };
    expect(chatBody.commands.map((command) => command.cmd)).not.toContain("mygrace:status");
    // === END_BLOCK_ASSERT_API_SLASH_METADATA ===
  });

  it("routes MyGRACE chat submissions through dashboard skill callbacks", () => {
    // === START_BLOCK_ASSERT_SUBMIT_ROUTING ===
    const startSkill = vi.fn();
    const runSkill = vi.fn();
    const log = vi.fn();

    const result = submitMyGraceSlash("/mygrace:multiagent-execute build wave", {
      startSkill,
      runSkill,
      log,
      clientIdFactory: () => "fixed-client",
    });

    expect(result).toEqual({
      handled: true,
      command: "/mygrace:multiagent",
      args: "build wave",
      skillName: "mygrace:multiagent",
      clientId: "fixed-client",
    });
    expect(startSkill).toHaveBeenCalledWith(
      { name: "mygrace:multiagent", runAs: "inline" },
      "build wave",
      "fixed-client",
    );
    expect(runSkill).toHaveBeenCalledWith("/mygrace:multiagent", "build wave");
    expect(log).toHaveBeenCalledWith(
      `${WEB_MYGRACE_LOG_MARKERS.routeSubmission} command=/mygrace:multiagent`,
    );
    // === END_BLOCK_ASSERT_SUBMIT_ROUTING ===
  });

  it("adds command palette actions for common MyGRACE workflows", () => {
    // === START_BLOCK_ASSERT_PALETTE_ACTIONS ===
    const submitted: string[] = [];
    const actions = getMyGraceCommandPaletteActions((command) => submitted.push(command));

    expect(actions.map((action) => action.id)).toEqual([
      "mygrace-status",
      "mygrace-lint",
      "mygrace-docs",
      "mygrace-skills",
    ]);
    actions[1]?.run();
    expect(submitted).toEqual(["/mygrace:cli lint"]);
    // === END_BLOCK_ASSERT_PALETTE_ACTIONS ===
  });

  it("keeps compact slash command labels inside the popup grid", () => {
    // === START_BLOCK_ASSERT_RESPONSIVE_LABELS ===
    const css = readFileSync("dashboard/src/styles.css", "utf8");

    expect(css).toContain("width: min(420px, calc(100vw - 24px));");
    expect(css).toContain("grid-template-columns: 24px minmax(0, 1fr) auto;");
    expect(css).toContain(".popup-item .nm .cmd");
    expect(css).toContain("text-overflow: ellipsis;");
    // === END_BLOCK_ASSERT_RESPONSIVE_LABELS ===
  });
});
