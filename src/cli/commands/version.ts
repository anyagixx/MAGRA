// === MODULE_CONTRACT ===
// FILE: src/cli/commands/version.ts
// VERSION: 1.0.0
// PURPOSE: Print the MAGRA CLI version banner.
// SCOPE: Plain stdout version command only.
// DEPENDS: M-MAGRA-RUNTIME-IDENTITY
// LINKS: docs/modules/M-MAGRA-RUNTIME-IDENTITY.xml
// ROLE: ENTRY_POINT
// MAP_MODE: EXPORTS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Exports: versionCommand
// Locals: none
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Updated version output to use the MAGRA primary CLI name.
// === END_CHANGE_SUMMARY ===

import { VERSION } from "../../index.js";
import { MAGRA_CLI_NAME } from "../../magra/identity.js";

export function versionCommand(): void {
  console.log(`${MAGRA_CLI_NAME} ${VERSION}`);
}
