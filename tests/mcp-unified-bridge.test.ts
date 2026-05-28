// === MODULE_CONTRACT ===
// FILE: tests/mcp-unified-bridge.test.ts
// VERSION: 1.0.0
// PURPOSE: Verify MAGRA unified MyGRACE and SNARC native tool bridge behavior.
// SCOPE: Tool registration, bounded invocation, structured errors, and registry isolation.
// DEPENDS: M-MCP-UNIFIED-BRIDGE
// LINKS: docs/verification/V-M-MCP-UNIFIED-BRIDGE.xml
// ROLE: TEST
// MAP_MODE: LOCALS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: MAGRA MCP bridge unit assertions
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial verification for MAGRA unified MCP/native tool bridge.
// === END_CHANGE_SUMMARY ===

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { invokeMagraTool, listMagraMcpTools, registerMagraTools } from "../src/mcp/magra-tools.js";
import { captureObservation } from "../src/snarc/memory.js";
import { ToolRegistry } from "../src/tools.js";

describe("MAGRA MCP unified bridge", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "magra-mcp-bridge-"));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("registers MyGRACE and SNARC tools alongside existing registry tools", async () => {
    // === START_BLOCK_ASSERT_REGISTER_TOOLS ===
    const registry = new ToolRegistry();
    registry.register({ name: "unrelated_tool", readOnly: true, fn: () => "ok" });
    registerMagraTools(registry, { rootDir: process.cwd() });

    expect(registry.has("unrelated_tool")).toBe(true);
    expect(registry.has("mygrace_list_modules")).toBe(true);
    expect(registry.has("snarc_stats")).toBe(true);
    expect(listMagraMcpTools().map((tool) => tool.name)).toContain("snarc_search");

    const output = await registry.dispatch("mygrace_show_module", { id: "M-SNARC-MEMORY" });
    expect(output).toContain("M-SNARC-MEMORY");
    // === END_BLOCK_ASSERT_REGISTER_TOOLS ===
  });

  it("returns bounded SNARC text output for tool calls", async () => {
    // === START_BLOCK_ASSERT_SNARC_TOOL_OUTPUT ===
    captureObservation({
      rootDir: tmpRoot,
      sessionId: "bridge-1",
      toolName: "run_command",
      input: "npm test tests/mcp-unified-bridge.test.ts",
      output: "PASS MAGRA MCP unified bridge SNARC search",
    });

    const result = await invokeMagraTool(
      "snarc_search",
      { query: "MCP bridge search", limit: 5 },
      { rootDir: tmpRoot, maxChars: 2000 },
    );

    expect(result.ok).toBe(true);
    expect(result.logMarker).toBe("[McpUnifiedBridge][invokeMagraTool][BLOCK_CALL_TOOL]");
    expect(result.text).toContain("observed");
    expect(result.text.length).toBeLessThanOrEqual(2000);
    // === END_BLOCK_ASSERT_SNARC_TOOL_OUTPUT ===
  });

  it("preserves errors as tool errors without breaking unrelated tools", async () => {
    // === START_BLOCK_ASSERT_ERROR_ISOLATION ===
    const registry = new ToolRegistry();
    registry.register({ name: "unrelated_tool", readOnly: true, fn: () => "ok" });
    registerMagraTools(registry, { rootDir: tmpRoot });

    const bad = await registry.dispatch("mygrace_show_module", { id: "M-NOPE" });
    expect(bad).toContain("error");

    const unrelated = await registry.dispatch("unrelated_tool", {});
    expect(unrelated).toBe("ok");

    const unknown = await invokeMagraTool("no_such_tool", {}, { rootDir: tmpRoot });
    expect(unknown.ok).toBe(false);
    // === END_BLOCK_ASSERT_ERROR_ISOLATION ===
  });
});
