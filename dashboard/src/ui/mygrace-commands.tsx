// === MODULE_CONTRACT ===
// FILE: dashboard/src/ui/mygrace-commands.tsx
// VERSION: 1.0.0
// PURPOSE: Expose canonical MyGRACE skills inside the MAGRA dashboard chat UI.
// SCOPE: Slash suggestions, command palette actions, command group rendering, and chat submission routing.
// DEPENDS: M-MYGRACE-SKILLS,M-MYGRACE-CLI-ADAPTER,M-REASONIX-BASE
// LINKS: docs/modules/M-WEB-MYGRACE-COMMANDS.xml
// ROLE: UI_COMPONENT
// MAP_MODE: EXPORTS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Exports: MYGRACE_DASHBOARD_COMMANDS, getMyGraceSlashCommands, getMyGraceCommandPaletteActions, renderMyGraceCommandGroup, submitMyGraceSlash
// Locals: MYGRACE_ALIAS_TO_ID, parseMyGraceSlash, findMyGraceCommand
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial MAGRA web command adapter for canonical MyGRACE skills.
// Added compatibility routing for /mygrace_init and /mygrace-init operator input.
// === END_CHANGE_SUMMARY ===

import { ClipboardCopy, FileText, Info, Search, Settings } from "lucide-react";
import type { ReactNode } from "react";
import type { Command } from "../CommandPalette";
import type { SlashCmd } from "./composer";

export type MyGraceDashboardCommandId =
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

export interface MyGraceDashboardCommand {
  id: MyGraceDashboardCommandId;
  command: `/mygrace:${string}`;
  label: string;
  description: string;
  category: "architecture" | "execution" | "diagnostics" | "reference";
}

export interface MyGraceSkillOrigin {
  name: string;
  runAs: "inline" | "subagent";
}

export interface SubmitMyGraceSlashContext {
  startSkill?: (skill: MyGraceSkillOrigin, args: string, clientId: string) => void;
  runSkill?: (command: string, args: string) => void;
  clientIdFactory?: () => string;
  log?: (message: string) => void;
}

export type SubmitMyGraceSlashResult =
  | {
      handled: true;
      command: `/mygrace:${string}`;
      args: string;
      skillName: string;
      clientId: string;
    }
  | {
      handled: false;
      reason: string;
    };

export const WEB_MYGRACE_LOG_MARKERS = Object.freeze({
  buildCommands: "[WebMyGraceCommands][getMyGraceSlashCommands][BLOCK_BUILD_COMMANDS]",
  routeSubmission: "[WebMyGraceCommands][submitMyGraceSlash][BLOCK_ROUTE_SUBMISSION]",
});

export const MYGRACE_DASHBOARD_COMMANDS: readonly MyGraceDashboardCommand[] = Object.freeze([
  Object.freeze({
    id: "init",
    command: "/mygrace:init",
    label: "MyGRACE Init",
    description: "Bootstrap index-based docs, modules, plans, and verification files.",
    category: "architecture",
  }),
  Object.freeze({
    id: "plan",
    command: "/mygrace:plan",
    label: "MyGRACE Plan",
    description: "Create or update architecture plans from requirements through contracts.",
    category: "architecture",
  }),
  Object.freeze({
    id: "verification",
    command: "/mygrace:verification",
    label: "MyGRACE Verification",
    description: "Design module-level verification and keep verification indexes current.",
    category: "architecture",
  }),
  Object.freeze({
    id: "execute",
    command: "/mygrace:execute",
    label: "MyGRACE Execute",
    description: "Execute the active plan phase with lazy index-first navigation.",
    category: "execution",
  }),
  Object.freeze({
    id: "multiagent",
    command: "/mygrace:multiagent",
    label: "MyGRACE Multiagent",
    description: "Run parallel MyGRACE worker waves with scoped module context.",
    category: "execution",
  }),
  Object.freeze({
    id: "refactor",
    command: "/mygrace:refactor",
    label: "MyGRACE Refactor",
    description: "Refactor governed code while updating modules and indexes atomically.",
    category: "execution",
  }),
  Object.freeze({
    id: "refresh",
    command: "/mygrace:refresh",
    label: "MyGRACE Refresh",
    description: "Synchronize graph, plan, and verification indexes with entity files.",
    category: "diagnostics",
  }),
  Object.freeze({
    id: "fix",
    command: "/mygrace:fix",
    label: "MyGRACE Fix",
    description: "Debug by navigating index to module to semantic block to patch.",
    category: "execution",
  }),
  Object.freeze({
    id: "reviewer",
    command: "/mygrace:reviewer",
    label: "MyGRACE Reviewer",
    description: "Audit MyGRACE integrity, module contracts, and verification quality.",
    category: "diagnostics",
  }),
  Object.freeze({
    id: "status",
    command: "/mygrace:status",
    label: "MyGRACE Status",
    description: "Show project health by reading only graph, plan, and verification indexes.",
    category: "diagnostics",
  }),
  Object.freeze({
    id: "ask",
    command: "/mygrace:ask",
    label: "MyGRACE Ask",
    description: "Answer project questions through lazy index and module loading.",
    category: "diagnostics",
  }),
  Object.freeze({
    id: "explainer",
    command: "/mygrace:explainer",
    label: "MyGRACE Explainer",
    description: "Open the full methodology reference for scalable GRACE workflows.",
    category: "reference",
  }),
  Object.freeze({
    id: "cli",
    command: "/mygrace:cli",
    label: "MyGRACE CLI",
    description: "Use MyGRACE CLI-style linting and lazy module queries.",
    category: "reference",
  }),
  Object.freeze({
    id: "setup-subagents",
    command: "/mygrace:setup-subagents",
    label: "MyGRACE Subagents",
    description: "Create lazy-loading-aware worker and reviewer subagent presets.",
    category: "reference",
  }),
]);

const MYGRACE_ALIAS_TO_ID = new Map<string, MyGraceDashboardCommandId>([
  ["multiagent_execute", "multiagent"],
  ["multiagent-execute", "multiagent"],
  ["multiagent", "multiagent"],
  ["setup_subagent", "setup-subagents"],
  ["setup_subagents", "setup-subagents"],
  ["setup-subagent", "setup-subagents"],
]);

export type MyGraceSlashSelect = (command: `/mygrace:${string}`) => void;

export interface MyGraceSlashCommandOptions {
  log?: (message: string) => void;
}

// === START_CONTRACT: getMyGraceSlashCommands ===
// PURPOSE: Build dashboard slash suggestions for every canonical MyGRACE skill.
// INPUTS: onSelect?: MyGraceSlashSelect; options?: MyGraceSlashCommandOptions
// OUTPUTS: SlashCmd[]
// SIDE_EFFECTS: optional diagnostic log callback
// === END_CONTRACT: getMyGraceSlashCommands ===
export function getMyGraceSlashCommands(
  onSelect: MyGraceSlashSelect = () => undefined,
  options: MyGraceSlashCommandOptions = {},
): SlashCmd[] {
  // === START_BLOCK_BUILD_COMMANDS ===
  options.log?.(
    `${WEB_MYGRACE_LOG_MARKERS.buildCommands} count=${MYGRACE_DASHBOARD_COMMANDS.length}`,
  );
  return MYGRACE_DASHBOARD_COMMANDS.map((spec) => ({
    cmd: spec.command,
    desc: spec.description,
    insertOnly: true,
    run: () => onSelect(spec.command),
  }));
  // === END_BLOCK_BUILD_COMMANDS ===
}

// === START_CONTRACT: getMyGraceCommandPaletteActions ===
// PURPOSE: Build command palette actions for common MyGRACE workflows.
// INPUTS: runCommand: function that submits a command string into chat
// OUTPUTS: Command[]
// SIDE_EFFECTS: none
// === END_CONTRACT: getMyGraceCommandPaletteActions ===
export function getMyGraceCommandPaletteActions(runCommand: (text: string) => void): Command[] {
  // === START_BLOCK_BUILD_PALETTE_ACTIONS ===
  return [
    {
      id: "mygrace-status",
      group: "workspace",
      label: "MyGRACE: status",
      hint: "/mygrace:status",
      icon: <Info size={13} />,
      run: () => runCommand("/mygrace:status"),
    },
    {
      id: "mygrace-lint",
      group: "workspace",
      label: "MyGRACE: lint",
      hint: "/mygrace:cli lint",
      icon: <Search size={13} />,
      run: () => runCommand("/mygrace:cli lint"),
    },
    {
      id: "mygrace-docs",
      group: "workspace",
      label: "MyGRACE: docs",
      hint: "/mygrace:ask docs navigation",
      icon: <FileText size={13} />,
      run: () => runCommand("/mygrace:ask docs navigation"),
    },
    {
      id: "mygrace-skills",
      group: "workspace",
      label: "MyGRACE: skills",
      hint: "/mygrace:explainer skills",
      icon: <ClipboardCopy size={13} />,
      run: () => runCommand("/mygrace:explainer skills"),
    },
  ];
  // === END_BLOCK_BUILD_PALETTE_ACTIONS ===
}

export interface MyGraceCommandGroupProps {
  commands?: readonly MyGraceDashboardCommand[];
  onPick?: (command: `/mygrace:${string}`) => void;
}

// === START_CONTRACT: renderMyGraceCommandGroup ===
// PURPOSE: Render a compact MyGRACE command group for dashboard surfaces that need explicit grouping.
// INPUTS: props: MyGraceCommandGroupProps
// OUTPUTS: ReactNode
// SIDE_EFFECTS: none
// === END_CONTRACT: renderMyGraceCommandGroup ===
export function renderMyGraceCommandGroup({
  commands = MYGRACE_DASHBOARD_COMMANDS,
  onPick,
}: MyGraceCommandGroupProps): ReactNode {
  // === START_BLOCK_RENDER_COMMAND_GROUP ===
  return (
    <div className="mygrace-command-group">
      {commands.map((command) => (
        <button
          key={command.command}
          type="button"
          className="mygrace-command"
          onClick={() => onPick?.(command.command)}
          title={command.description}
        >
          <Settings size={12} />
          <span>{command.command}</span>
        </button>
      ))}
    </div>
  );
  // === END_BLOCK_RENDER_COMMAND_GROUP ===
}

// === START_CONTRACT: submitMyGraceSlash ===
// PURPOSE: Route a chat submission for `/mygrace:*` into the MyGRACE skill runner callbacks.
// INPUTS: text: string; dashboardContext: SubmitMyGraceSlashContext
// OUTPUTS: SubmitMyGraceSlashResult
// SIDE_EFFECTS: invokes callbacks when the command is handled
// === END_CONTRACT: submitMyGraceSlash ===
export function submitMyGraceSlash(
  text: string,
  dashboardContext: SubmitMyGraceSlashContext,
): SubmitMyGraceSlashResult {
  // === START_BLOCK_ROUTE_SUBMISSION ===
  const parsed = parseMyGraceSlash(text);
  if (!parsed) return { handled: false, reason: "not-mygrace-command" };

  const command = findMyGraceCommand(parsed.id);
  if (!command) return { handled: false, reason: `unknown-mygrace-command:${parsed.id}` };

  const clientId =
    dashboardContext.clientIdFactory?.() ??
    `mygrace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const skillName = `mygrace:${command.id}`;
  dashboardContext.log?.(`${WEB_MYGRACE_LOG_MARKERS.routeSubmission} command=${command.command}`);
  dashboardContext.startSkill?.({ name: skillName, runAs: "inline" }, parsed.args, clientId);
  dashboardContext.runSkill?.(command.command, parsed.args);

  return { handled: true, command: command.command, args: parsed.args, skillName, clientId };
  // === END_BLOCK_ROUTE_SUBMISSION ===
}

function parseMyGraceSlash(text: string): { id: string; args: string } | null {
  const match = text.trim().match(/^(?:\/|\$)mygrace(?::|_|-)([a-z0-9_-]+)(?:\s+([\s\S]*))?$/i);
  const id = match?.[1]?.toLowerCase().replace(/_/g, "-");
  if (!id) return null;
  return { id, args: match?.[2]?.trim() ?? "" };
}

function findMyGraceCommand(id: string): MyGraceDashboardCommand | undefined {
  const canonical = MYGRACE_ALIAS_TO_ID.get(id) ?? (id as MyGraceDashboardCommandId);
  return MYGRACE_DASHBOARD_COMMANDS.find((command) => command.id === canonical);
}
