// === MODULE_CONTRACT ===
// FILE: src/tools/rtk-shell-policy.ts
// VERSION: 1.0.0
// PURPOSE: Route eligible MAGRA shell commands through RTK while preserving shell semantics.
// SCOPE: RTK health probing, command classification, command rewriting, raw bypass, and savings parsing.
// DEPENDS: M-REASONIX-BASE
// LINKS: docs/modules/M-RTK-SHELL-POLICY.xml
// ROLE: INTEGRATION
// MAP_MODE: EXPORTS
// START_MODULE_CONTRACT
// END_MODULE_CONTRACT
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Exports: resolveRtkPolicy, buildRtkCommand, readRtkSavings, createRtkSessionSavingsTracker, diagnoseRtk
// Locals: isEligibleForRtk, isEligiblePackageCommand, defaultRtkRunner, parseSavings, parseCompactNumber, buildRtkSessionSavingsSnapshot
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial RTK shell policy integration for MAGRA command routing and diagnostics.
// Added session-delta RTK savings tracker for dashboard telemetry.
// === END_CHANGE_SUMMARY ===

import { spawnSync } from "node:child_process";
import { basename } from "node:path";
import { detectShellOperator, tokenizeCommand } from "./shell/parse.js";

export type RtkDecisionMode = "rtk" | "raw";
export type RtkHealthStatus = "ok" | "missing" | "error";

export interface RtkCommandRunnerResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: { message: string; code?: string };
}

export type RtkCommandRunner = (
  binary: string,
  args: readonly string[],
  cwd?: string,
) => RtkCommandRunnerResult;

export interface RtkPolicyContext {
  rootDir?: string;
  rtkBinary?: string;
  rtkAvailable?: boolean;
  rawMode?: boolean;
  env?: Record<string, string | undefined>;
}

export interface RtkDecision {
  mode: RtkDecisionMode;
  rawCommand: string;
  effectiveCommand: string;
  reason: string;
  eligible: boolean;
  rtkBinary: string;
  logMarker: string;
}

export interface ShellCommand {
  command: string;
  rawCommand: string;
  viaRtk: boolean;
  reason: string;
}

export interface RtkHealth {
  status: RtkHealthStatus;
  available: boolean;
  binary: string;
  detail: string;
  version?: string;
}

export interface RtkSavingsSummary {
  available: boolean;
  binary: string;
  detail: string;
  rawOutput: string;
  totalCommands?: number;
  inputTokens?: number;
  outputTokens?: number;
  tokensSaved?: number;
  percentSaved?: number;
}

export interface RtkSessionSavingsSnapshot extends RtkSavingsSummary {
  startedAt: string;
  updatedAt: string;
  baselineTokensSaved?: number;
  baselineInputTokens?: number;
  sessionTokensSaved?: number;
  sessionInputTokens?: number;
  sessionPercentSaved?: number;
}

export interface RtkSessionSavingsTracker {
  read(root?: string): RtkSessionSavingsSnapshot;
  reset(root?: string): RtkSessionSavingsSnapshot;
}

export interface RtkProbeOptions {
  binary?: string;
  cwd?: string;
  runner?: RtkCommandRunner;
}

const LOG_MARKERS = Object.freeze({
  classify: "[RtkShellPolicy][resolveRtkPolicy][BLOCK_CLASSIFY_COMMAND]",
  rewrite: "[RtkShellPolicy][buildRtkCommand][BLOCK_REWRITE_COMMAND]",
});

const SIMPLE_ELIGIBLE_HEADS = new Set([
  "biome",
  "cargo",
  "eslint",
  "go",
  "jest",
  "mypy",
  "pytest",
  "ruff",
  "tsc",
  "vitest",
]);

const GIT_READ_COMMANDS = new Set(["status", "diff", "log", "show", "grep", "ls-files"]);
const PACKAGE_TEST_COMMANDS = new Set(["build", "check", "lint", "test", "typecheck"]);

// === START_CONTRACT: resolveRtkPolicy ===
// PURPOSE: Classify a command and decide whether MAGRA should run it through RTK.
// INPUTS: command: string; context?: RtkPolicyContext
// OUTPUTS: RtkDecision
// SIDE_EFFECTS: none
// === END_CONTRACT: resolveRtkPolicy ===
export function resolveRtkPolicy(command: string, context: RtkPolicyContext = {}): RtkDecision {
  // === START_BLOCK_CLASSIFY_COMMAND ===
  const rawCommand = command.trim();
  const rtkBinary = context.rtkBinary?.trim() || "rtk";
  const rawByEnv = context.env?.MAGRA_RTK_RAW === "1" || context.env?.RTK_RAW === "1";
  const rawByCommand = rawCommand === rtkBinary || rawCommand.startsWith(`${rtkBinary} `);

  if (!rawCommand) {
    return rawDecision(rawCommand, rtkBinary, "empty-command", false);
  }
  if (context.rawMode || rawByEnv || rawByCommand) {
    return rawDecision(rawCommand, rtkBinary, "raw-bypass", false);
  }
  if (detectShellOperator(rawCommand)) {
    return rawDecision(rawCommand, rtkBinary, "compound-shell-command", false);
  }

  let argv: string[];
  try {
    argv = tokenizeCommand(rawCommand);
  } catch {
    return rawDecision(rawCommand, rtkBinary, "unparseable-command", false);
  }

  const eligible = isEligibleForRtk(argv);
  if (!eligible) {
    return rawDecision(rawCommand, rtkBinary, "not-rtk-eligible", false);
  }
  if (context.rtkAvailable === false) {
    return rawDecision(rawCommand, rtkBinary, "rtk-unavailable", true);
  }

  return {
    mode: "rtk",
    rawCommand,
    effectiveCommand: `${rtkBinary} ${rawCommand}`,
    reason: "eligible",
    eligible: true,
    rtkBinary,
    logMarker: LOG_MARKERS.classify,
  };
  // === END_BLOCK_CLASSIFY_COMMAND ===
}

// === START_CONTRACT: buildRtkCommand ===
// PURPOSE: Convert an RTK decision into the shell command that must be displayed and executed.
// INPUTS: decision: RtkDecision
// OUTPUTS: ShellCommand
// SIDE_EFFECTS: none
// === END_CONTRACT: buildRtkCommand ===
export function buildRtkCommand(decision: RtkDecision): ShellCommand {
  // === START_BLOCK_REWRITE_COMMAND ===
  return {
    command: decision.effectiveCommand,
    rawCommand: decision.rawCommand,
    viaRtk: decision.mode === "rtk",
    reason: `${LOG_MARKERS.rewrite} ${decision.reason}`,
  };
  // === END_BLOCK_REWRITE_COMMAND ===
}

// === START_CONTRACT: diagnoseRtk ===
// PURPOSE: Detect RTK availability and version for doctor/dashboard health.
// INPUTS: options?: RtkProbeOptions
// OUTPUTS: RtkHealth
// SIDE_EFFECTS: spawns `rtk --version` unless a runner is injected
// === END_CONTRACT: diagnoseRtk ===
export function diagnoseRtk(options: RtkProbeOptions = {}): RtkHealth {
  // === START_BLOCK_PROBE_RTK ===
  const binary = options.binary?.trim() || "rtk";
  const result = (options.runner ?? defaultRtkRunner)(binary, ["--version"], options.cwd);
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  if (result.error) {
    return {
      status: "missing",
      available: false,
      binary,
      detail: result.error.message,
    };
  }
  if (result.status !== 0) {
    return {
      status: "error",
      available: false,
      binary,
      detail: output || `rtk exited with status ${result.status ?? "unknown"}`,
    };
  }
  return {
    status: "ok",
    available: true,
    binary,
    version: output || undefined,
    detail: output || "rtk available",
  };
  // === END_BLOCK_PROBE_RTK ===
}

// === START_CONTRACT: readRtkSavings ===
// PURPOSE: Read RTK token-savings telemetry in a bounded, parseable summary.
// INPUTS: root?: string; options?: RtkProbeOptions
// OUTPUTS: RtkSavingsSummary
// SIDE_EFFECTS: spawns `rtk gain` unless a runner is injected
// === END_CONTRACT: readRtkSavings ===
export function readRtkSavings(root?: string, options: RtkProbeOptions = {}): RtkSavingsSummary {
  // === START_BLOCK_READ_SAVINGS ===
  const binary = options.binary?.trim() || "rtk";
  const result = (options.runner ?? defaultRtkRunner)(binary, ["gain"], root ?? options.cwd);
  const rawOutput = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  if (result.error || result.status !== 0) {
    return {
      available: false,
      binary,
      detail: result.error?.message ?? rawOutput ?? "rtk gain unavailable",
      rawOutput,
    };
  }
  return {
    available: true,
    binary,
    detail: rawOutput || "rtk gain returned no savings data",
    rawOutput,
    ...parseSavings(rawOutput),
  };
  // === END_BLOCK_READ_SAVINGS ===
}

// === START_CONTRACT: createRtkSessionSavingsTracker ===
// PURPOSE: Track RTK token savings since the current dashboard/server session started.
// INPUTS: root?: string; options?: RtkProbeOptions
// OUTPUTS: RtkSessionSavingsTracker
// SIDE_EFFECTS: reads RTK savings telemetry when read/reset is called
// === END_CONTRACT: createRtkSessionSavingsTracker ===
export function createRtkSessionSavingsTracker(
  root?: string,
  options: RtkProbeOptions = {},
): RtkSessionSavingsTracker {
  // === START_BLOCK_TRACK_SESSION_SAVINGS ===
  let startedAt = new Date().toISOString();
  let baseline: RtkSavingsSummary | null = null;

  const readCurrent = (targetRoot?: string): RtkSavingsSummary =>
    readRtkSavings(targetRoot ?? root, options);

  return {
    read(targetRoot?: string): RtkSessionSavingsSnapshot {
      const current = readCurrent(targetRoot);
      if (
        !baseline ||
        (!baseline.available && current.available) ||
        (typeof baseline.tokensSaved !== "number" && typeof current.tokensSaved === "number")
      ) {
        baseline = current;
      }
      return buildRtkSessionSavingsSnapshot(startedAt, baseline, current);
    },
    reset(targetRoot?: string): RtkSessionSavingsSnapshot {
      startedAt = new Date().toISOString();
      baseline = readCurrent(targetRoot);
      return buildRtkSessionSavingsSnapshot(startedAt, baseline, baseline);
    },
  };
  // === END_BLOCK_TRACK_SESSION_SAVINGS ===
}

function rawDecision(
  rawCommand: string,
  rtkBinary: string,
  reason: string,
  eligible: boolean,
): RtkDecision {
  return {
    mode: "raw",
    rawCommand,
    effectiveCommand: rawCommand,
    reason,
    eligible,
    rtkBinary,
    logMarker: LOG_MARKERS.classify,
  };
}

function isEligibleForRtk(argv: readonly string[]): boolean {
  const head = basename(argv[0] ?? "")
    .replace(/\.(?:cmd|exe|bat)$/i, "")
    .toLowerCase();
  if (!head || head.includes("=")) return false;

  if (head === "rtk") return false;
  if (head === "git") {
    return GIT_READ_COMMANDS.has((argv[1] ?? "").toLowerCase());
  }
  if (head === "npm" || head === "pnpm" || head === "yarn" || head === "bun") {
    return isEligiblePackageCommand(head, argv);
  }
  if (head === "cargo") {
    return ["build", "check", "clippy", "test"].includes((argv[1] ?? "").toLowerCase());
  }
  if (head === "go") {
    return ["build", "test", "vet"].includes((argv[1] ?? "").toLowerCase());
  }
  return SIMPLE_ELIGIBLE_HEADS.has(head);
}

function isEligiblePackageCommand(head: string, argv: readonly string[]): boolean {
  const first = (argv[1] ?? "").toLowerCase();
  if (head === "bun" && first === "test") return true;
  if (first === "test") return true;
  if (PACKAGE_TEST_COMMANDS.has(first)) return true;
  if (first !== "run") return false;
  const script = (argv[2] ?? "").toLowerCase();
  return PACKAGE_TEST_COMMANDS.has(script);
}

function defaultRtkRunner(
  binary: string,
  args: readonly string[],
  cwd?: string,
): RtkCommandRunnerResult {
  const result = spawnSync(binary, [...args], {
    cwd,
    encoding: "utf8",
    shell: false,
    timeout: 2000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error ? { message: result.error.message, code: result.error.name } : undefined,
  };
}

function parseSavings(
  rawOutput: string,
): Pick<
  RtkSavingsSummary,
  "totalCommands" | "inputTokens" | "outputTokens" | "tokensSaved" | "percentSaved"
> {
  const totalCommands = parseNamedNumber(rawOutput, "Total commands");
  const inputTokens = parseNamedNumber(rawOutput, "Input tokens");
  const outputTokens = parseNamedNumber(rawOutput, "Output tokens");
  const tokensSavedLine = findNamedLine(rawOutput, "Tokens saved");
  const tokensSaved =
    parseCompactNumber(tokensSavedLine?.split(":").slice(1).join(":").trim().split(/\s+/)[0]) ??
    parseFallbackSavedTokens(rawOutput);
  const percentMatch =
    tokensSavedLine?.match(/\((\d+(?:\.\d+)?)\s*%\)/) ?? rawOutput.match(/(\d+(?:\.\d+)?)\s*%/);
  const percentSaved = percentMatch?.[1] ? Number(percentMatch[1]) : undefined;
  return {
    ...(Number.isFinite(totalCommands) ? { totalCommands } : {}),
    ...(Number.isFinite(inputTokens) ? { inputTokens } : {}),
    ...(Number.isFinite(outputTokens) ? { outputTokens } : {}),
    ...(Number.isFinite(tokensSaved) ? { tokensSaved } : {}),
    ...(Number.isFinite(percentSaved) ? { percentSaved } : {}),
  };
}

function buildRtkSessionSavingsSnapshot(
  startedAt: string,
  baseline: RtkSavingsSummary,
  current: RtkSavingsSummary,
): RtkSessionSavingsSnapshot {
  const sessionTokensSaved =
    current.available &&
    baseline.available &&
    typeof current.tokensSaved === "number" &&
    typeof baseline.tokensSaved === "number"
      ? Math.max(0, current.tokensSaved - baseline.tokensSaved)
      : undefined;
  const sessionInputTokens =
    current.available &&
    baseline.available &&
    typeof current.inputTokens === "number" &&
    typeof baseline.inputTokens === "number"
      ? Math.max(0, current.inputTokens - baseline.inputTokens)
      : undefined;
  const sessionPercentSaved =
    typeof sessionTokensSaved === "number" && typeof sessionInputTokens === "number"
      ? sessionInputTokens > 0
        ? (sessionTokensSaved / sessionInputTokens) * 100
        : 0
      : undefined;
  return {
    ...current,
    startedAt,
    updatedAt: new Date().toISOString(),
    ...(typeof baseline.tokensSaved === "number"
      ? { baselineTokensSaved: baseline.tokensSaved }
      : {}),
    ...(typeof baseline.inputTokens === "number"
      ? { baselineInputTokens: baseline.inputTokens }
      : {}),
    ...(typeof sessionTokensSaved === "number" ? { sessionTokensSaved } : {}),
    ...(typeof sessionInputTokens === "number" ? { sessionInputTokens } : {}),
    ...(typeof sessionPercentSaved === "number" ? { sessionPercentSaved } : {}),
  };
}

function findNamedLine(rawOutput: string, label: string): string | undefined {
  const lowerLabel = label.toLowerCase();
  return rawOutput.split(/\r?\n/).find((line) => line.trim().toLowerCase().startsWith(lowerLabel));
}

function parseNamedNumber(rawOutput: string, label: string): number | undefined {
  const line = findNamedLine(rawOutput, label);
  const raw = line?.split(":").slice(1).join(":").trim().split(/\s+/)[0];
  return parseCompactNumber(raw);
}

function parseFallbackSavedTokens(rawOutput: string): number | undefined {
  const tokensMatch =
    rawOutput.match(/(?:saved|savings|gain)[^\d]*(\d[\d,.]*\s*[kmb]?)(?:\s+tokens?)?/i) ??
    rawOutput.match(/(\d[\d,.]*\s*[kmb]?)\s+tokens?\s+(?:saved|saved by|reduced)/i);
  return parseCompactNumber(tokensMatch?.[1]);
}

function parseCompactNumber(raw: string | undefined): number | undefined {
  const normalized = raw?.trim().replace(/,/g, "").replace(/\s+/g, "").toLowerCase();
  if (!normalized) return undefined;
  const match = normalized.match(/^(\d+(?:\.\d+)?)([kmb])?$/);
  if (!match) return undefined;
  const value = Number(match[1]);
  const suffix = match[2];
  if (!Number.isFinite(value)) return undefined;
  const multiplier =
    suffix === "b" ? 1_000_000_000 : suffix === "m" ? 1_000_000 : suffix === "k" ? 1_000 : 1;
  return Math.round(value * multiplier);
}
