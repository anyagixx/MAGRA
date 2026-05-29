import { SLASH_COMMANDS } from "../../cli/ui/slash/commands.js";
import { type MyGraceSkillId, listMyGraceSkills } from "../../mygrace/skills.js";
import type { DashboardContext } from "../context.js";
import type { ApiResult } from "../router.js";

const MYGRACE_ARGS_HINT: Partial<Record<MyGraceSkillId, string>> = {
  ask: "<question>",
  cli: "[module|phase|verification|lint ...]",
  execute: "[phase|module]",
  fix: "<issue>",
  init: "[force]",
  plan: "[requirements]",
  refactor: "<scope>",
  verification: "[module]",
};

const MYGRACE_ALIASES: Partial<Record<MyGraceSkillId, readonly string[]>> = {
  init: ["mygrace_init", "mygrace-init"],
  plan: ["mygrace_plan", "mygrace-plan"],
  verification: ["mygrace_verification", "mygrace-verification"],
  execute: ["mygrace_execute", "mygrace-execute"],
  multiagent: ["mygrace_multiagent", "mygrace-multiagent", "mygrace:multiagent-execute"],
  refactor: ["mygrace_refactor", "mygrace-refactor"],
  refresh: ["mygrace_refresh", "mygrace-refresh"],
  fix: ["mygrace_fix", "mygrace-fix"],
  reviewer: ["mygrace_reviewer", "mygrace-reviewer"],
  status: ["mygrace_status", "mygrace-status"],
  ask: ["mygrace_ask", "mygrace-ask"],
  explainer: ["mygrace_explainer", "mygrace-explainer"],
  cli: ["mygrace_cli", "mygrace-cli"],
  "setup-subagents": [
    "mygrace_setup-subagents",
    "mygrace_setup_subagents",
    "mygrace-setup-subagents",
    "mygrace:setup-subagent",
  ],
};

export async function handleSlash(
  method: string,
  _rest: string[],
  _body: string,
  ctx: DashboardContext,
): Promise<ApiResult> {
  if (method !== "GET") return { status: 405, body: { error: "GET only" } };
  const codeMode = ctx.getCurrentCwd?.() != null;
  const commands = SLASH_COMMANDS.filter((c) => c.contextual !== "code" || codeMode).map((c) => ({
    cmd: c.cmd,
    summary: c.summary,
    argsHint: c.argsHint,
    contextual: c.contextual,
    aliases: c.aliases,
  }));
  if (codeMode) {
    commands.push(
      ...listMyGraceSkills().map((skill) => ({
        cmd: skill.command.replace(/^\//, ""),
        summary: skill.description,
        argsHint: MYGRACE_ARGS_HINT[skill.id],
        contextual: "code" as const,
        aliases: MYGRACE_ALIASES[skill.id],
      })),
    );
  }
  return { status: 200, body: { commands, codeMode } };
}
