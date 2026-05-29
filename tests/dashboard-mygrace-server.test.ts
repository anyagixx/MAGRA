// === MODULE_CONTRACT ===
// FILE: tests/dashboard-mygrace-server.test.ts
// VERSION: 1.0.0
// PURPOSE: Verify MAGRA dashboard server routing for MyGRACE skill commands.
// SCOPE: `/api/skills/run` MyGRACE command resolution and prompt packet submission.
// DEPENDS: M-WEB-MYGRACE-COMMANDS,M-MYGRACE-SKILLS
// LINKS: docs/verification/V-M-WEB-MYGRACE-COMMANDS.xml
// ROLE: TEST
// MAP_MODE: LOCALS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: dashboard server MyGRACE resolver assertions
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial verification for server-side MyGRACE skill dispatch.
// Added server-side compatibility alias coverage for /mygrace_init.
// === END_CHANGE_SUMMARY ===

import { describe, expect, it } from "vitest";
import { handleSkills } from "../src/server/api/skills.js";

describe("dashboard server MyGRACE routing", () => {
  it("resolves MyGRACE commands through the shared runtime resolver", async () => {
    // === START_BLOCK_ASSERT_SERVER_RESOLVER ===
    const submitted: string[] = [];
    const response = await handleSkills(
      "POST",
      ["run"],
      JSON.stringify({ command: "/mygrace:status" }),
      {
        configPath: "",
        usageLogPath: "",
        mode: "attached",
        getCurrentCwd: () => process.cwd(),
        submitPrompt: (prompt) => {
          submitted.push(prompt);
          return { accepted: true };
        },
      },
    );

    expect(response.status).toBe(202);
    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toContain("# Skill: mygrace-status");
    expect(submitted[0]).toContain("LAZY REPORT");
    // === END_BLOCK_ASSERT_SERVER_RESOLVER ===
  });

  it("accepts underscore MyGRACE aliases from the dashboard bridge", async () => {
    // === START_BLOCK_ASSERT_SERVER_ALIAS_RESOLVER ===
    const submitted: string[] = [];
    const response = await handleSkills(
      "POST",
      ["run"],
      JSON.stringify({ command: "/mygrace_init", args: "new project" }),
      {
        configPath: "",
        usageLogPath: "",
        mode: "attached",
        getCurrentCwd: () => process.cwd(),
        submitPrompt: (prompt) => {
          submitted.push(prompt);
          return { accepted: true };
        },
      },
    );

    expect(response.status).toBe(202);
    expect(submitted[0]).toContain("# Skill: mygrace-init");
    expect(submitted[0]).toContain("Arguments: new project");
    // === END_BLOCK_ASSERT_SERVER_ALIAS_RESOLVER ===
  });
});
