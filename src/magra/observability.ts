// === MODULE_CONTRACT ===
// FILE: src/magra/observability.ts
// VERSION: 1.0.0
// PURPOSE: Provide MAGRA health, verification command, and log-marker utilities.
// SCOPE: Pure helpers for Phase-1 attribution and later MyGRACE/RTK/SNARC integration diagnostics.
// DEPENDS: M-MAGRA-RUNTIME-IDENTITY
// LINKS: docs/modules/M-OBSERVABILITY-VERIFICATION.xml
// ROLE: RUNTIME
// MAP_MODE: EXPORTS
// START_MODULE_CONTRACT
// END_MODULE_CONTRACT
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Exports: MAGRA_PROJECT_NAME, formatLogMarker, getMagraHealth, listVerificationCommands
// Locals: DEFAULT_COMPONENT_HEALTH, VERIFICATION_COMMANDS, cloneComponentHealth, deriveOverallStatus
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial MAGRA observability utility module for Phase-1 baseline work.
// Updated to reuse canonical MAGRA runtime identity constant.
// === END_CHANGE_SUMMARY ===

import { MAGRA_PROJECT_NAME } from "./identity.js";

export { MAGRA_PROJECT_NAME };

export type MagraComponentName = "reasonix" | "mygrace" | "rtk" | "snarc" | "mcp" | "verification";

export type MagraHealthStatus = "ok" | "degraded" | "missing";
export type MagraOverallStatus = "ok" | "degraded";
export type VerificationScope = "module" | "wave" | "phase";

export interface MagraComponentHealth {
  status: MagraHealthStatus;
  detail: string;
  version?: string;
}

export type MagraHealthInput = Partial<Record<MagraComponentName, Partial<MagraComponentHealth>>>;

export interface MagraHealthReport {
  projectName: typeof MAGRA_PROJECT_NAME;
  overallStatus: MagraOverallStatus;
  components: Record<MagraComponentName, MagraComponentHealth>;
}

export interface VerificationCommand {
  id: string;
  moduleId: string;
  scope: VerificationScope;
  command: string;
  focus: string;
}

const DEFAULT_COMPONENT_HEALTH: Record<MagraComponentName, MagraComponentHealth> = {
  reasonix: {
    status: "ok",
    detail: "Reasonix base runtime is imported and available.",
  },
  mygrace: {
    status: "ok",
    detail: "MyGRACE docs, CLI adapter, and canonical skill registry are available.",
  },
  rtk: {
    status: "ok",
    detail: "RTK shell policy is integrated for eligible MAGRA shell commands.",
  },
  snarc: {
    status: "ok",
    detail: "SNARC memory, loop adapter, native tools, and dashboard API are integrated.",
  },
  mcp: {
    status: "ok",
    detail:
      "Unified MAGRA MyGRACE and SNARC tools are registered through the Reasonix tool surface.",
  },
  verification: {
    status: "ok",
    detail: "MyGRACE verification artifacts are present and lintable.",
  },
};

const VERIFICATION_COMMANDS: readonly VerificationCommand[] = Object.freeze([
  {
    id: "V-REASONIX-BUILD",
    moduleId: "M-REASONIX-BASE",
    scope: "phase",
    command: "rtk npm run build",
    focus: "Reasonix base and dashboard build compatibility.",
  },
  {
    id: "V-REASONIX-TYPECHECK",
    moduleId: "M-REASONIX-BASE",
    scope: "phase",
    command: "rtk npm run typecheck",
    focus: "TypeScript compatibility after MAGRA attribution.",
  },
  {
    id: "V-MAGRA-OBSERVABILITY",
    moduleId: "M-OBSERVABILITY-VERIFICATION",
    scope: "module",
    command: "rtk npm test -- tests/magra-observability.test.ts",
    focus: "Health report, verification command registry, and log-marker formatting.",
  },
  {
    id: "V-MYGRACE-LINT",
    moduleId: "M-MYGRACE-DOCS",
    scope: "wave",
    command: "rtk mygrace lint --path .",
    focus: "Index and per-entity MyGRACE artifact consistency.",
  },
  {
    id: "V-RTK-SHELL-POLICY",
    moduleId: "M-RTK-SHELL-POLICY",
    scope: "module",
    command: "rtk npm test -- tests/rtk-shell-policy.test.ts",
    focus: "RTK command classification, raw bypass, health probing, and savings parsing.",
  },
  {
    id: "V-SNARC-MEMORY",
    moduleId: "M-SNARC-MEMORY",
    scope: "module",
    command: "rtk npm test -- tests/snarc-memory.test.ts",
    focus:
      "SNARC capture, search, briefing, consolidation, redaction, and bounded storage failure behavior.",
  },
  {
    id: "V-SNARC-LOOP-ADAPTER",
    moduleId: "M-SNARC-LOOP-ADAPTER",
    scope: "module",
    command: "rtk npm test -- tests/snarc-loop-adapter.test.ts",
    focus:
      "SNARC prompt injection, tool capture, compaction capture, stop consolidation, and failure isolation.",
  },
  {
    id: "V-MCP-UNIFIED-BRIDGE",
    moduleId: "M-MCP-UNIFIED-BRIDGE",
    scope: "module",
    command: "rtk npm test -- tests/mcp-unified-bridge.test.ts",
    focus: "MAGRA MyGRACE and SNARC native tool registration, invocation, and error isolation.",
  },
  {
    id: "V-SNARC-DASHBOARD-API",
    moduleId: "M-SNARC-DASHBOARD-API",
    scope: "module",
    command: "rtk npm test -- tests/dashboard-snarc-server.test.ts",
    focus: "Dashboard SNARC stats and provenance-labeled memory search.",
  },
]);

// === START_CONTRACT: formatLogMarker ===
// PURPOSE: Format a stable MAGRA/MyGRACE log marker.
// INPUTS: moduleName/functionName/blockName: string - non-empty marker segments
// OUTPUTS: string
// SIDE_EFFECTS: none
// === END_CONTRACT: formatLogMarker ===
export function formatLogMarker(
  moduleName: string,
  functionName: string,
  blockName: string,
): string {
  // === START_BLOCK_VALIDATE_MARKER_PARTS ===
  const parts = [moduleName, functionName, blockName].map((part) => part.trim());
  if (parts.some((part) => part.length === 0)) {
    throw new Error("MAGRA log marker parts must be non-empty");
  }
  if (parts.some((part) => part.includes("[") || part.includes("]"))) {
    throw new Error("MAGRA log marker parts must not contain square brackets");
  }
  // === END_BLOCK_VALIDATE_MARKER_PARTS ===

  // === START_BLOCK_FORMAT_MARKER ===
  return `[${parts[0]}][${parts[1]}][${parts[2]}]`;
  // === END_BLOCK_FORMAT_MARKER ===
}

// === START_CONTRACT: listVerificationCommands ===
// PURPOSE: Return MAGRA verification commands, optionally filtered by verification scope.
// INPUTS: scope?: VerificationScope - optional command scope filter
// OUTPUTS: VerificationCommand[]
// SIDE_EFFECTS: none
// === END_CONTRACT: listVerificationCommands ===
export function listVerificationCommands(scope?: VerificationScope): VerificationCommand[] {
  // === START_BLOCK_FILTER_COMMANDS ===
  const commands = scope
    ? VERIFICATION_COMMANDS.filter((command) => command.scope === scope)
    : VERIFICATION_COMMANDS;
  // === END_BLOCK_FILTER_COMMANDS ===

  // === START_BLOCK_CLONE_COMMANDS ===
  return commands.map((command) => ({ ...command }));
  // === END_BLOCK_CLONE_COMMANDS ===
}

// === START_CONTRACT: getMagraHealth ===
// PURPOSE: Build a MAGRA health report from default component state plus caller overrides.
// INPUTS: input?: MagraHealthInput - optional component status overrides
// OUTPUTS: MagraHealthReport
// SIDE_EFFECTS: none
// === END_CONTRACT: getMagraHealth ===
export function getMagraHealth(input: MagraHealthInput = {}): MagraHealthReport {
  // === START_BLOCK_COLLECT_HEALTH ===
  const components = cloneComponentHealth(DEFAULT_COMPONENT_HEALTH);
  for (const [name, override] of Object.entries(input) as Array<
    [MagraComponentName, Partial<MagraComponentHealth>]
  >) {
    components[name] = { ...components[name], ...override };
  }
  // === END_BLOCK_COLLECT_HEALTH ===

  // === START_BLOCK_DERIVE_OVERALL_STATUS ===
  return {
    projectName: MAGRA_PROJECT_NAME,
    overallStatus: deriveOverallStatus(components),
    components,
  };
  // === END_BLOCK_DERIVE_OVERALL_STATUS ===
}

function cloneComponentHealth(
  components: Record<MagraComponentName, MagraComponentHealth>,
): Record<MagraComponentName, MagraComponentHealth> {
  return {
    reasonix: { ...components.reasonix },
    mygrace: { ...components.mygrace },
    rtk: { ...components.rtk },
    snarc: { ...components.snarc },
    mcp: { ...components.mcp },
    verification: { ...components.verification },
  };
}

function deriveOverallStatus(
  components: Record<MagraComponentName, MagraComponentHealth>,
): MagraOverallStatus {
  return Object.values(components).every((component) => component.status === "ok")
    ? "ok"
    : "degraded";
}
