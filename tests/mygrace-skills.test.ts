// === MODULE_CONTRACT ===
// FILE: tests/mygrace-skills.test.ts
// VERSION: 1.0.0
// PURPOSE: Verify MAGRA MyGRACE skill registry and slash resolver.
// SCOPE: Canonical skill metadata, command aliases, lazy body loading, and run packets.
// DEPENDS: M-MYGRACE-SKILLS
// LINKS: docs/verification/V-M-MYGRACE-SKILLS.xml
// ROLE: TEST
// MAP_MODE: LOCALS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: MyGRACE skill registry unit assertions
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial tests for MAGRA MyGRACE skill registry.
// Added compatibility alias coverage for underscore and hyphen MyGRACE command separators.
// === END_CHANGE_SUMMARY ===

import { describe, expect, it } from "vitest";
import {
  listMyGraceSkills,
  loadMyGraceSkillBody,
  resolveMyGraceCommand,
  runMyGraceSkill,
} from "../src/mygrace/skills.js";

describe("MyGRACE skill registry", () => {
  it("lists all canonical MyGRACE slash commands", () => {
    // === START_BLOCK_ASSERT_SKILL_METADATA ===
    const skills = listMyGraceSkills();
    expect(skills).toHaveLength(14);
    expect(skills.map((skill) => skill.command)).toEqual([
      "/mygrace:init",
      "/mygrace:plan",
      "/mygrace:verification",
      "/mygrace:execute",
      "/mygrace:multiagent",
      "/mygrace:refactor",
      "/mygrace:refresh",
      "/mygrace:fix",
      "/mygrace:reviewer",
      "/mygrace:status",
      "/mygrace:ask",
      "/mygrace:explainer",
      "/mygrace:cli",
      "/mygrace:setup-subagents",
    ]);
    // === END_BLOCK_ASSERT_SKILL_METADATA ===
  });

  it("resolves canonical commands, aliases, and unknown commands deterministically", () => {
    // === START_BLOCK_ASSERT_COMMAND_RESOLUTION ===
    const ask = resolveMyGraceCommand("/mygrace:ask explain M-MYGRACE-DOCS");
    expect(ask.ok).toBe(true);
    expect(ask.ok ? ask.skill.id : "").toBe("ask");
    expect(ask.ok ? ask.args : "").toBe("explain M-MYGRACE-DOCS");

    const alias = resolveMyGraceCommand("$mygrace:multiagent-execute");
    expect(alias.ok).toBe(true);
    expect(alias.ok ? alias.skill.command : "").toBe("/mygrace:multiagent");

    const underscore = resolveMyGraceCommand("/mygrace_init build docs");
    expect(underscore.ok).toBe(true);
    expect(underscore.ok ? underscore.skill.command : "").toBe("/mygrace:init");
    expect(underscore.ok ? underscore.args : "").toBe("build docs");

    const hyphen = resolveMyGraceCommand("/mygrace-setup_subagents");
    expect(hyphen.ok).toBe(true);
    expect(hyphen.ok ? hyphen.skill.command : "").toBe("/mygrace:setup-subagents");

    const unknown = resolveMyGraceCommand("/mygrace:missing");
    expect(unknown.ok).toBe(false);
    expect(unknown.ok ? [] : unknown.availableCommands).toContain("/mygrace:status");
    // === END_BLOCK_ASSERT_COMMAND_RESOLUTION ===
  });

  it("loads one skill body lazily and returns runnable playbook packets", async () => {
    // === START_BLOCK_ASSERT_SKILL_BODY_LOADING ===
    const body = loadMyGraceSkillBody("status");
    expect(body).toContain("name: mygrace-status");

    const invocation = resolveMyGraceCommand("/mygrace:status");
    const result = await runMyGraceSkill(invocation, { rootDir: process.cwd() });
    expect(result.ok).toBe(true);
    expect(result.ok ? result.body : "").toContain("LAZY REPORT");
    expect(result.ok ? result.rootDir : "").toBe(process.cwd());
    // === END_BLOCK_ASSERT_SKILL_BODY_LOADING ===
  });
});
