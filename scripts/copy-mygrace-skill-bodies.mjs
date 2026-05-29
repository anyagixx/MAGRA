// === MODULE_CONTRACT ===
// FILE: scripts/copy-mygrace-skill-bodies.mjs
// VERSION: 1.0.0
// PURPOSE: Copy bundled MyGRACE skill markdown bodies into every runtime dist location that imports them by relative URL.
// SCOPE: Build-time asset copy for dist/index.js and dist/cli/*.js MyGRACE skill body loading.
// DEPENDS: M-MYGRACE-SKILLS
// LINKS: docs/modules/M-MYGRACE-SKILL-ASSETS.xml
// ROLE: BUILD
// MAP_MODE: SCRIPT
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: source, targets, copy loop
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// v1.0.0 - Copy MyGRACE skill bodies beside library and CLI bundles.
// === END_CHANGE_SUMMARY ===

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const source = join(root, "src", "mygrace", "skill-bodies");
const targets = [
  join(root, "dist", "skill-bodies"),
  join(root, "dist", "cli", "skill-bodies"),
];

if (existsSync(source)) {
  // === START_BLOCK_COPY_SKILL_BODIES ===
  for (const target of targets) {
    rmSync(target, { recursive: true, force: true });
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, { recursive: true });
    console.log(`copied ${source} -> ${target}`);
  }
  // === END_BLOCK_COPY_SKILL_BODIES ===
}
