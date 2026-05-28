// === MODULE_CONTRACT ===
// FILE: src/cli/node-version.ts
// VERSION: 1.0.0
// PURPOSE: Guard MAGRA startup against unsupported Node.js versions before heavy imports run.
// SCOPE: Node major parsing, support check, error formatting, and process exit guard.
// DEPENDS: none
// LINKS: docs/modules/M-MAGRA-RUNTIME-IDENTITY.xml
// ROLE: UTILITY
// MAP_MODE: EXPORTS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Exports: MIN_NODE_MAJOR, parseNodeMajor, isSupportedNodeVersion, unsupportedNodeMessage, enforceSupportedNodeVersion
// Locals: none
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Updated unsupported Node startup message to use MAGRA primary identity.
// === END_CHANGE_SUMMARY ===

export const MIN_NODE_MAJOR = 22;

export function parseNodeMajor(version: string): number | null {
  const major = Number.parseInt(version.split(".")[0] ?? "", 10);
  return Number.isInteger(major) ? major : null;
}

export function isSupportedNodeVersion(
  version = process.versions.node,
  minMajor = MIN_NODE_MAJOR,
): boolean {
  const major = parseNodeMajor(version);
  return major !== null && major >= minMajor;
}

export function unsupportedNodeMessage(
  version = process.versions.node,
  minMajor = MIN_NODE_MAJOR,
): string {
  return `MAGRA requires Node ${minMajor}+ (current: ${version}). Install Node ${minMajor} or newer and rerun magra.`;
}

export function enforceSupportedNodeVersion(
  version = process.versions.node,
  minMajor = MIN_NODE_MAJOR,
): void {
  if (isSupportedNodeVersion(version, minMajor)) return;
  process.stderr.write(`${unsupportedNodeMessage(version, minMajor)}\n`);
  process.exit(1);
}
