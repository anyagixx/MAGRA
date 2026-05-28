// === MODULE_CONTRACT ===
// FILE: tests/magra-dogfooding-smoke.test.ts
// VERSION: 1.0.0
// PURPOSE: Verify MAGRA dogfooding workflows against disposable pet-project fixtures.
// SCOPE: Node CLI, React/Vite layout, docs/tooling MyGRACE lint, RTK rewrite, SNARC SQLite recall, and dashboard SNARC API.
// DEPENDS: M-MAGRA-DOGFOODING-HARNESS
// LINKS: docs/verification/V-M-MAGRA-DOGFOODING-HARNESS.xml
// ROLE: TEST
// MAP_MODE: LOCALS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: disposable project builders, scenario smoke assertions, report assertions
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial deterministic dogfooding smoke coverage for MAGRA private beta readiness.
// === END_CHANGE_SUMMARY ===

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getMyGraceSlashCommands, submitMyGraceSlash } from "../dashboard/src/ui/mygrace-commands";
import { lintMyGraceArtifacts } from "../src/mygrace/docs.js";
import { resolveMyGraceCommand } from "../src/mygrace/skills.js";
import { handleSnarc } from "../src/server/api/snarc.js";
import { captureObservation, resolveSnarcMemoryPath, searchMemory } from "../src/snarc/memory.js";
import { buildRtkCommand, resolveRtkPolicy } from "../src/tools/rtk-shell-policy.js";

describe("MAGRA dogfooding smoke", () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("runs a disposable Node CLI pet-project command and verifies RTK rewrite behavior", () => {
    // === START_BLOCK_ASSERT_NODE_CLI_SCENARIO ===
    const root = createTempRoot("magra-node-cli-");
    writeProjectFile(
      root,
      "cli.mjs",
      [
        "const name = process.argv[2] ?? 'world';",
        "console.log(`hello ${name} from MAGRA dogfood`);",
      ].join("\n"),
    );

    const result = spawnSync(process.execPath, ["cli.mjs", "pet-project"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("hello pet-project from MAGRA dogfood");

    const rtkDecision = resolveRtkPolicy("npm test -- tests/magra-dogfooding-smoke.test.ts", {
      rtkAvailable: true,
    });
    expect(rtkDecision.mode).toBe("rtk");
    expect(buildRtkCommand(rtkDecision)).toMatchObject({
      command: "rtk npm test -- tests/magra-dogfooding-smoke.test.ts",
      viaRtk: true,
    });
    // === END_BLOCK_ASSERT_NODE_CLI_SCENARIO ===
  });

  it("models a React/Vite pet-project and verifies web chat MyGRACE routing", () => {
    // === START_BLOCK_ASSERT_REACT_VITE_SCENARIO ===
    const root = createTempRoot("magra-react-vite-");
    writeProjectFile(
      root,
      "package.json",
      JSON.stringify(
        {
          name: "magra-react-vite-dogfood",
          type: "module",
          scripts: { dev: "vite", build: "vite build", test: "node ./src/App.jsx" },
          dependencies: { "@vitejs/plugin-react": "fixture", vite: "fixture" },
        },
        null,
        2,
      ),
    );
    writeProjectFile(
      root,
      "index.html",
      '<div id="root"></div><script type="module" src="/src/App.jsx"></script>',
    );
    writeProjectFile(
      root,
      "src/App.jsx",
      "export default function App() { return <main>MAGRA dogfood</main>; }\n",
    );

    const slashCommands = getMyGraceSlashCommands().map((command) => command.cmd);
    expect(slashCommands).toContain("/mygrace:execute");
    expect(slashCommands).toContain("/mygrace:reviewer");
    expect(slashCommands).toContain("/mygrace:ask");

    const startSkill = vi.fn();
    const runSkill = vi.fn();
    const routed = submitMyGraceSlash("/mygrace:execute continue Phase-12", {
      startSkill,
      runSkill,
      clientIdFactory: () => "dogfood-client",
    });
    expect(routed).toMatchObject({
      handled: true,
      command: "/mygrace:execute",
      args: "continue Phase-12",
    });
    expect(startSkill).toHaveBeenCalledWith(
      { name: "mygrace:execute", runAs: "inline" },
      "continue Phase-12",
      "dogfood-client",
    );
    expect(runSkill).toHaveBeenCalledWith("/mygrace:execute", "continue Phase-12");
    expect(existsSync(join(root, "src", "App.jsx"))).toBe(true);
    // === END_BLOCK_ASSERT_REACT_VITE_SCENARIO ===
  });

  it("runs docs/tooling MyGRACE lint on a disposable governed project", () => {
    // === START_BLOCK_ASSERT_DOCS_TOOLING_SCENARIO ===
    const root = createTempRoot("magra-docs-tooling-");
    createDisposableMyGraceProject(root);

    const reviewer = resolveMyGraceCommand("/mygrace:reviewer full");
    expect(reviewer.ok).toBe(true);
    if (reviewer.ok) expect(reviewer.skill.command).toBe("/mygrace:reviewer");

    const report = lintMyGraceArtifacts(root);
    expect(report.errors).toBe(0);
    expect(report.warnings).toBe(0);
    // === END_BLOCK_ASSERT_DOCS_TOOLING_SCENARIO ===
  });

  it("recalls SNARC memory from SQLite after a simulated restart and exposes dashboard API search", async () => {
    // === START_BLOCK_ASSERT_SNARC_RECALL_SCENARIO ===
    const rootDir = createTempRoot("magra-snarc-dogfood-");
    const captured = captureObservation({
      rootDir,
      sessionId: "dogfood-snarc-1",
      toolName: "run_command",
      input: "dogfooding SQLite recall and dashboard search",
      output: "PASS MAGRA dogfooding SNARC recall",
    });
    expect(captured.captured).toBe(true);
    expect(resolveSnarcMemoryPath(rootDir)).toMatch(/memory\.sqlite$/);
    expect(existsSync(resolveSnarcMemoryPath(rootDir))).toBe(true);

    const recalled = searchMemory("MAGRA dogfooding SNARC recall", { rootDir });
    expect(recalled[0]).toMatchObject({
      sessionId: "dogfood-snarc-1",
      provenance: "observed",
    });

    const ctx = {
      configPath: "",
      usageLogPath: "",
      mode: "attached" as const,
      getCurrentCwd: () => rootDir,
    };
    const stats = await handleSnarc("GET", [], "", ctx, new URLSearchParams());
    expect(stats.status).toBe(200);
    expect((stats.body as { stats: { observations: number } }).stats.observations).toBe(1);

    const search = await handleSnarc(
      "GET",
      ["search"],
      "",
      ctx,
      new URLSearchParams({ query: "dogfooding SNARC recall" }),
    );
    expect(search.status).toBe(200);
    expect((search.body as { results: Array<{ provenance: string }> }).results[0]?.provenance).toBe(
      "observed",
    );
    // === END_BLOCK_ASSERT_SNARC_RECALL_SCENARIO ===
  });

  it("keeps the dogfooding report actionable and beta-readiness bounded", () => {
    // === START_BLOCK_ASSERT_REPORT_CONTENT ===
    const report = readFileSync("docs/dogfooding/MAGRA-dogfooding-report.md", "utf8");
    expect(report).toContain("Node CLI pet project");
    expect(report).toContain("React/Vite pet project");
    expect(report).toContain("Docs/tooling project");
    expect(report).toContain("No critical or high dogfooding blockers were found");
    expect(report).toContain("P1 | Run browser-based dashboard dogfooding");
    // === END_BLOCK_ASSERT_REPORT_CONTENT ===
  });

  function createTempRoot(prefix: string): string {
    const root = mkdtempSync(join(tmpdir(), prefix));
    tempRoots.push(root);
    return root;
  }

  function createDisposableMyGraceProject(root: string): void {
    mkdirSync(join(root, "docs", "plans"), { recursive: true });
    writeProjectFile(
      root,
      "docs/graph-index.xml",
      '<GraphIndex project="DOGFOOD"><M-PET NAME="PetTool" TYPE="UTILITY" STATUS="done" PATH="src/tool.ts" DEPENDS="" VERIFICATION_REF="V-M-PET" /></GraphIndex>',
    );
    writeProjectFile(root, "docs/plan-index.xml", '<PlanIndex project="DOGFOOD" />');
    writeProjectFile(
      root,
      "docs/verification-index.xml",
      '<VerificationIndex project="DOGFOOD"><V-M-PET MODULE="M-PET" PRIORITY="high" STATUS="done" /></VerificationIndex>',
    );
    writeProjectFile(
      root,
      "docs/modules/M-PET.xml",
      '<M-PET NAME="PetTool" TYPE="UTILITY" STATUS="done"><contract><source-path>src/tool.ts</source-path><verification-ref>V-M-PET</verification-ref></contract></M-PET>',
    );
    writeProjectFile(
      root,
      "docs/verification/V-M-PET.xml",
      '<V-M-PET MODULE="M-PET" PRIORITY="high" STATUS="done" />',
    );
    writeProjectFile(
      root,
      "src/tool.ts",
      [
        sourceCommentMarkup("MODULE_CONTRACT"),
        "// FILE: src/tool.ts",
        "// VERSION: 1.0.0",
        "// PURPOSE: Disposable dogfooding fixture.",
        "// SCOPE: MyGRACE governance smoke.",
        "// DEPENDS: M-PET",
        "// LINKS: docs/modules/M-PET.xml",
        "// ROLE: UTILITY",
        "// MAP_MODE: EXPORTS",
        sourceCommentMarkup("END_MODULE_CONTRACT"),
        "",
        sourceCommentMarkup("MODULE_MAP"),
        "// Exports: petTool",
        sourceCommentMarkup("END_MODULE_MAP"),
        "",
        sourceCommentMarkup("CHANGE_SUMMARY"),
        "// Initial disposable dogfooding fixture.",
        sourceCommentMarkup("END_CHANGE_SUMMARY"),
        "",
        "export function petTool(): string {",
        "  return 'MAGRA dogfood';",
        "}",
      ].join("\n"),
    );
  }

  function writeProjectFile(root: string, path: string, content: string): void {
    const absolutePath = join(root, path);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  }

  function sourceCommentMarkup(marker: string): string {
    return ["//", "===", marker, "==="].join(" ");
  }
});
