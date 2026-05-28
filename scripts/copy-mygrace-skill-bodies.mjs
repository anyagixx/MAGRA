import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const source = join(root, "src", "mygrace", "skill-bodies");
const target = join(root, "dist", "mygrace", "skill-bodies");

if (existsSync(source)) {
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}
