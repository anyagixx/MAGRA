// === MODULE_CONTRACT ===
// FILE: src/mygrace/skills.ts
// VERSION: 1.0.0
// PURPOSE: Expose canonical MyGRACE skills as MAGRA slash-command playbooks.
// SCOPE: Skill metadata, command resolution, lazy body loading, and deterministic run packets.
// DEPENDS: M-MYGRACE-DOCS,M-REASONIX-BASE
// LINKS: docs/modules/M-MYGRACE-SKILLS.xml
// ROLE: RUNTIME
// MAP_MODE: EXPORTS
// START_MODULE_CONTRACT
// END_MODULE_CONTRACT
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Exports: listMyGraceSkills, resolveMyGraceCommand, runMyGraceSkill, loadMyGraceSkillBody
// Locals: MYGRACE_SKILLS, MYGRACE_SKILL_BY_ID, MYGRACE_ALIAS_TO_ID, parseMyGraceCommand
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial canonical MyGRACE skill registry and lazy skill body loader.
// Added compatibility parsing for /mygrace_init and /mygrace-init operator input.
// === END_CHANGE_SUMMARY ===

import { readFileSync } from "node:fs";

export type MyGraceSkillId =
  | "init"
  | "plan"
  | "verification"
  | "execute"
  | "multiagent"
  | "refactor"
  | "refresh"
  | "fix"
  | "reviewer"
  | "status"
  | "ask"
  | "explainer"
  | "cli"
  | "setup-subagents";

export interface MyGraceSkillMeta {
  id: MyGraceSkillId;
  command: `/mygrace:${string}`;
  sourceSkillName: string;
  bodyFile: string;
  description: string;
  category: "architecture" | "execution" | "diagnostics" | "reference";
}

export type MyGraceInvocation =
  | {
      ok: true;
      rawCommand: string;
      skill: MyGraceSkillMeta;
      args: string;
    }
  | {
      ok: false;
      rawCommand: string;
      reason: string;
      availableCommands: string[];
    };

export interface MyGraceSkillRunContext {
  rootDir?: string;
}

export type SkillResult =
  | {
      ok: true;
      command: string;
      skill: MyGraceSkillMeta;
      body: string;
      args: string;
      rootDir?: string;
    }
  | {
      ok: false;
      command: string;
      reason: string;
      availableCommands: string[];
    };

const MYGRACE_SKILLS: readonly MyGraceSkillMeta[] = Object.freeze([
  Object.freeze({
    id: "init",
    command: "/mygrace:init",
    sourceSkillName: "mygrace-init",
    bodyFile: "init.md",
    description:
      "Bootstrap MyGRACE framework structure for a new project. Creates docs/ with index-based architecture, per-module/phase/verification directories, and templates.",
    category: "architecture",
  }),
  Object.freeze({
    id: "plan",
    command: "/mygrace:plan",
    sourceSkillName: "mygrace-plan",
    bodyFile: "plan.md",
    description:
      "Run the MyGRACE architectural planning phase. Creates per-module files, per-phase files, and updates indexes instead of monolithic XML.",
    category: "architecture",
  }),
  Object.freeze({
    id: "verification",
    command: "/mygrace:verification",
    sourceSkillName: "mygrace-verification",
    bodyFile: "verification.md",
    description:
      "Design verification for MyGRACE projects. Creates per-module verification files and updates verification-index.",
    category: "architecture",
  }),
  Object.freeze({
    id: "execute",
    command: "/mygrace:execute",
    sourceSkillName: "mygrace-execute",
    bodyFile: "execute.md",
    description:
      "Execute the MyGRACE development plan with lazy-loading, reading only the current phase and relevant modules.",
    category: "execution",
  }),
  Object.freeze({
    id: "multiagent",
    command: "/mygrace:multiagent",
    sourceSkillName: "mygrace-multiagent-execute",
    bodyFile: "multiagent.md",
    description:
      "Execute MyGRACE plan in parallel waves with lazy-loading. Each wave reads only its phases and modules, not the entire plan.",
    category: "execution",
  }),
  Object.freeze({
    id: "refactor",
    command: "/mygrace:refactor",
    sourceSkillName: "mygrace-refactor",
    bodyFile: "refactor.md",
    description:
      "Refactor MyGRACE-governed code safely. Updates per-module files AND indexes atomically.",
    category: "execution",
  }),
  Object.freeze({
    id: "refresh",
    command: "/mygrace:refresh",
    sourceSkillName: "mygrace-refresh",
    bodyFile: "refresh.md",
    description:
      "Synchronize MyGRACE indexes with per-entity files. Detects drift between graph-index.xml and docs/modules/, plan-index.xml and docs/plans/.",
    category: "diagnostics",
  }),
  Object.freeze({
    id: "fix",
    command: "/mygrace:fix",
    sourceSkillName: "mygrace-fix",
    bodyFile: "fix.md",
    description:
      "Debug using MyGRACE lazy navigation. Index to relevant module to block to fix. Minimal context token usage.",
    category: "execution",
  }),
  Object.freeze({
    id: "reviewer",
    command: "/mygrace:reviewer",
    sourceSkillName: "mygrace-reviewer",
    bodyFile: "reviewer.md",
    description:
      "MyGRACE integrity reviewer. Checks index consistency, per-module file correctness, and verification quality with lazy scope.",
    category: "diagnostics",
  }),
  Object.freeze({
    id: "status",
    command: "/mygrace:status",
    sourceSkillName: "mygrace-status",
    bodyFile: "status.md",
    description:
      "Show MyGRACE project health by reading ONLY index files. Fast and token-efficient.",
    category: "diagnostics",
  }),
  Object.freeze({
    id: "ask",
    command: "/mygrace:ask",
    sourceSkillName: "mygrace-ask",
    bodyFile: "ask.md",
    description:
      "Answer a question about a MyGRACE project using lazy-loading indexes. Loads only relevant modules without burning context tokens.",
    category: "diagnostics",
  }),
  Object.freeze({
    id: "explainer",
    command: "/mygrace:explainer",
    sourceSkillName: "mygrace-explainer",
    bodyFile: "explainer.md",
    description:
      "Complete MyGRACE methodology reference. Scalable GRACE with lazy-loading indexes, per-module files, and phase-based navigation for large projects.",
    category: "reference",
  }),
  Object.freeze({
    id: "cli",
    command: "/mygrace:cli",
    sourceSkillName: "mygrace-cli",
    bodyFile: "cli.md",
    description:
      "Operate the optional mygrace CLI for linting and lazy module queries. Uses index-based navigation instead of monolithic XML.",
    category: "reference",
  }),
  Object.freeze({
    id: "setup-subagents",
    command: "/mygrace:setup-subagents",
    sourceSkillName: "mygrace-setup-subagents",
    bodyFile: "setup-subagents.md",
    description:
      "Create MyGRACE subagent presets for Qwen Code. Scaffold lazy-loading-aware worker and reviewer agents.",
    category: "reference",
  }),
]);

const MYGRACE_SKILL_BY_ID = new Map(MYGRACE_SKILLS.map((skill) => [skill.id, skill]));
const MYGRACE_ALIAS_TO_ID = new Map<string, MyGraceSkillId>([
  ["multiagent_execute", "multiagent"],
  ["multiagent-execute", "multiagent"],
  ["multiagent", "multiagent"],
  ["setup_subagent", "setup-subagents"],
  ["setup_subagents", "setup-subagents"],
  ["setup-subagent", "setup-subagents"],
]);

// === START_CONTRACT: listMyGraceSkills ===
// PURPOSE: Return canonical MyGRACE skill metadata without loading skill bodies.
// INPUTS: none
// OUTPUTS: MyGraceSkillMeta[]
// SIDE_EFFECTS: none
// === END_CONTRACT: listMyGraceSkills ===
export function listMyGraceSkills(): MyGraceSkillMeta[] {
  // === START_BLOCK_LOAD_METADATA ===
  return MYGRACE_SKILLS.map((skill) => ({ ...skill }));
  // === END_BLOCK_LOAD_METADATA ===
}

// === START_CONTRACT: resolveMyGraceCommand ===
// PURPOSE: Resolve a `/mygrace:*` command string into a canonical skill invocation.
// INPUTS: command: string - user-entered slash command
// OUTPUTS: MyGraceInvocation
// SIDE_EFFECTS: none
// === END_CONTRACT: resolveMyGraceCommand ===
export function resolveMyGraceCommand(command: string): MyGraceInvocation {
  // === START_BLOCK_RESOLVE_COMMAND ===
  const parsed = parseMyGraceCommand(command);
  if (!parsed) {
    return {
      ok: false,
      rawCommand: command,
      reason: "Expected a /mygrace:* command.",
      availableCommands: availableCommands(),
    };
  }
  const id = MYGRACE_ALIAS_TO_ID.get(parsed.id) ?? (parsed.id as MyGraceSkillId);
  const skill = MYGRACE_SKILL_BY_ID.get(id);
  if (!skill) {
    return {
      ok: false,
      rawCommand: command,
      reason: `Unknown MyGRACE command: /mygrace:${parsed.id}`,
      availableCommands: availableCommands(),
    };
  }
  return { ok: true, rawCommand: command, skill: { ...skill }, args: parsed.args };
  // === END_BLOCK_RESOLVE_COMMAND ===
}

// === START_CONTRACT: loadMyGraceSkillBody ===
// PURPOSE: Lazily read one canonical MyGRACE skill body from bundled runtime assets.
// INPUTS: skillId: MyGraceSkillId
// OUTPUTS: string
// SIDE_EFFECTS: reads files
// === END_CONTRACT: loadMyGraceSkillBody ===
export function loadMyGraceSkillBody(skillId: MyGraceSkillId): string {
  // === START_BLOCK_LOAD_SKILL_BODY ===
  const skill = MYGRACE_SKILL_BY_ID.get(skillId);
  if (!skill) throw new Error(`Unknown MyGRACE skill: ${skillId}`);
  return readFileSync(new URL(`./skill-bodies/${skill.bodyFile}`, import.meta.url), "utf8");
  // === END_BLOCK_LOAD_SKILL_BODY ===
}

// === START_CONTRACT: runMyGraceSkill ===
// PURPOSE: Return a deterministic runnable playbook packet for a resolved MyGRACE invocation.
// INPUTS: invocation: MyGraceInvocation; context?: MyGraceSkillRunContext
// OUTPUTS: Promise<SkillResult>
// SIDE_EFFECTS: lazily reads one skill body
// === END_CONTRACT: runMyGraceSkill ===
export async function runMyGraceSkill(
  invocation: MyGraceInvocation,
  context: MyGraceSkillRunContext = {},
): Promise<SkillResult> {
  // === START_BLOCK_DISPATCH_SKILL ===
  if (!invocation.ok) {
    return {
      ok: false,
      command: invocation.rawCommand,
      reason: invocation.reason,
      availableCommands: invocation.availableCommands,
    };
  }
  const body = loadMyGraceSkillBody(invocation.skill.id);
  return {
    ok: true,
    command: invocation.skill.command,
    skill: invocation.skill,
    body,
    args: invocation.args,
    rootDir: context.rootDir,
  };
  // === END_BLOCK_DISPATCH_SKILL ===
}

function parseMyGraceCommand(command: string): { id: string; args: string } | null {
  const trimmed = command.trim();
  const match = trimmed.match(/^(?:\/|\$)?mygrace(?::|_|-)([a-z0-9_-]+)(?:\s+([\s\S]*))?$/i);
  const id = match?.[1]?.toLowerCase().replace(/_/g, "-");
  if (!id) return null;
  return { id, args: match?.[2]?.trim() ?? "" };
}

function availableCommands(): string[] {
  return MYGRACE_SKILLS.map((skill) => skill.command);
}
