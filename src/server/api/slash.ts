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
  multiagent: ["mygrace:multiagent-execute"],
  "setup-subagents": ["mygrace:setup-subagent"],
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
