// === MODULE_CONTRACT ===
// FILE: src/magra/identity.ts
// VERSION: 1.0.0
// PURPOSE: Provide canonical MAGRA runtime identity constants, alias helpers, and default prompt text.
// SCOPE: Product name, CLI name, code assistant name, compatibility aliases, and chat system prompt.
// DEPENDS: M-REASONIX-BASE
// LINKS: docs/modules/M-MAGRA-RUNTIME-IDENTITY.xml
// ROLE: RUNTIME
// MAP_MODE: EXPORTS
// START_MODULE_CONTRACT
// END_MODULE_CONTRACT
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Exports: MAGRA_PROJECT_NAME, MAGRA_CLI_NAME, MAGRA_CODE_NAME, MAGRA_COMPATIBILITY_ALIASES, defaultSystemPrompt, formatCompatibilityAlias, isCompatibilityAlias
// Locals: normalizeAlias
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial MAGRA runtime identity module for Phase-9 prompt and alias governance.
// === END_CHANGE_SUMMARY ===

import { escalationContract } from "../prompt-fragments.js";

export const MAGRA_PROJECT_NAME = "MAGRA";
export const MAGRA_CLI_NAME = "magra";
export const MAGRA_CODE_NAME = "MAGRA Code";
export const MAGRA_COMPATIBILITY_ALIASES = ["reasonix", "dsnix"] as const;

export type MagraCompatibilityAlias = (typeof MAGRA_COMPATIBILITY_ALIASES)[number];

// === START_CONTRACT: isCompatibilityAlias ===
// PURPOSE: Return whether a command name is a supported MAGRA compatibility alias.
// INPUTS: alias: string - command or alias name to classify
// OUTPUTS: boolean
// SIDE_EFFECTS: none
// === END_CONTRACT: isCompatibilityAlias ===
export function isCompatibilityAlias(alias: string): alias is MagraCompatibilityAlias {
  // === START_BLOCK_NORMALIZE_ALIAS_FOR_CHECK ===
  const normalized = normalizeAlias(alias);
  // === END_BLOCK_NORMALIZE_ALIAS_FOR_CHECK ===

  // === START_BLOCK_CHECK_ALIAS ===
  return MAGRA_COMPATIBILITY_ALIASES.some((candidate) => candidate === normalized);
  // === END_BLOCK_CHECK_ALIAS ===
}

// === START_CONTRACT: formatCompatibilityAlias ===
// PURPOSE: Format user-facing compatibility alias metadata without making the alias the primary product name.
// INPUTS: alias: string - known compatibility alias
// OUTPUTS: string
// SIDE_EFFECTS: throws Error for unsupported aliases
// === END_CONTRACT: formatCompatibilityAlias ===
export function formatCompatibilityAlias(alias: string): string {
  // === START_BLOCK_VALIDATE_ALIAS ===
  const normalized = normalizeAlias(alias);
  if (!isCompatibilityAlias(normalized)) {
    throw new Error(`Unsupported MAGRA compatibility alias: ${alias}`);
  }
  // === END_BLOCK_VALIDATE_ALIAS ===

  // === START_BLOCK_FORMAT_ALIAS ===
  return `${normalized} is a compatibility alias for ${MAGRA_CLI_NAME} and routes to ${MAGRA_PROJECT_NAME}.`;
  // === END_BLOCK_FORMAT_ALIAS ===
}

// === START_CONTRACT: defaultSystemPrompt ===
// PURPOSE: Build the default chat-mode system prompt with MAGRA as the fixed runtime identity.
// INPUTS: modelId: string - resolved model identifier used by escalation contract
// OUTPUTS: string
// SIDE_EFFECTS: none
// === END_CONTRACT: defaultSystemPrompt ===
export function defaultSystemPrompt(modelId: string): string {
  // === START_BLOCK_BUILD_PROMPT ===
  const aliases = MAGRA_COMPATIBILITY_ALIASES.map(formatCompatibilityAlias).join(" ");
  return `You are ${MAGRA_PROJECT_NAME}, a helpful DeepSeek-powered assistant. Be concise and accurate. Use tools when available.

${aliases}

# Cite or shut up - non-negotiable

Every factual claim about a codebase must be backed by evidence. ${MAGRA_PROJECT_NAME} VALIDATES your citations - broken paths render in **red strikethrough with X** in front of the user.

**Positive claims** - append a markdown link:
- OK \`The MCP client supports listResources [listResources](src/mcp/client.ts:142).\`
- BAD \`The MCP client supports listResources.\` <- unverifiable, do not write.

**Negative claims** ("X is missing", "Y isn't implemented", "lacks Z") are the #1 hallucination shape. STOP before writing them. If you have a search tool, call it first; if the search returns nothing, cite the search itself as evidence (\`No matches for "foo" in src/\`). If you have no tool, qualify hard: "I haven't verified - this is a guess."

Asserting absence without checking is how evaluative answers go wrong. Treat the urge to write "missing" as a red flag in your own reasoning.

# Don't invent what changes - search instead

Your training data has a cutoff. When an answer's correctness depends on something that changes over time (the user is asking what's happening, not what's true) and a search tool is available, search first. Inventing currently-correct values from training memory is the most common way these answers go wrong, and the user usually can't tell until much later.

The signal isn't a topic list - it's: "if I'm wrong about this, is it because reality moved on?". If yes, ground the answer in fresh evidence; if no (definitions, mechanisms, well-established APIs), answer from memory.

${escalationContract(modelId)}`;
  // === END_BLOCK_BUILD_PROMPT ===
}

function normalizeAlias(alias: string): string {
  return alias.trim().toLowerCase();
}
