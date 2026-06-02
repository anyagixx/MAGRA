// === MODULE_CONTRACT ===
// FILE: src/server/api/rtk.ts
// VERSION: 1.0.0
// PURPOSE: Expose read-only RTK savings telemetry to the MAGRA dashboard.
// SCOPE: Dashboard RTK savings endpoint and session-delta response shaping.
// DEPENDS: M-RTK-SHELL-POLICY,M-REASONIX-BASE
// LINKS: docs/modules/M-RTK-DASHBOARD-API.xml
// ROLE: INTEGRATION
// MAP_MODE: EXPORTS
// START_MODULE_CONTRACT
// END_MODULE_CONTRACT
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Exports: handleRtk
// Locals: publicSavingsSnapshot
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Initial dashboard RTK session savings endpoint.
// === END_CHANGE_SUMMARY ===

import type { RtkSessionSavingsSnapshot } from "../../tools/rtk-shell-policy.js";
import type { DashboardContext } from "../context.js";
import type { ApiResult } from "../router.js";

type PublicRtkSavingsSnapshot = Omit<RtkSessionSavingsSnapshot, "rawOutput">;

// === START_CONTRACT: publicSavingsSnapshot ===
// PURPOSE: Remove server-only RTK raw telemetry before returning dashboard JSON.
// INPUTS: snapshot: RtkSessionSavingsSnapshot
// OUTPUTS: PublicRtkSavingsSnapshot
// SIDE_EFFECTS: none
// === END_CONTRACT: publicSavingsSnapshot ===
function publicSavingsSnapshot(snapshot: RtkSessionSavingsSnapshot): PublicRtkSavingsSnapshot {
  // === START_BLOCK_PUBLIC_SAVINGS_SNAPSHOT ===
  const { rawOutput: _rawOutput, ...publicSnapshot } = snapshot;
  return publicSnapshot;
  // === END_BLOCK_PUBLIC_SAVINGS_SNAPSHOT ===
}

// === START_CONTRACT: handleRtk ===
// PURPOSE: Route dashboard RTK telemetry API requests.
// INPUTS: method: string; rest: string[]; _body: string; ctx: DashboardContext
// OUTPUTS: Promise<ApiResult>
// SIDE_EFFECTS: reads RTK savings telemetry through ctx.getRtkSessionSavings when available
// === END_CONTRACT: handleRtk ===
export async function handleRtk(
  method: string,
  rest: string[],
  _body: string,
  ctx: DashboardContext,
): Promise<ApiResult> {
  // === START_BLOCK_RTK_SAVINGS_ROUTE ===
  if (method !== "GET") return { status: 405, body: { error: "GET only" } };
  const head = rest[0] ?? "savings";
  if (head !== "savings") return { status: 404, body: { error: `no such RTK endpoint: ${head}` } };
  const snapshot = ctx.getRtkSessionSavings?.();
  if (!snapshot) {
    return {
      status: 200,
      body: {
        available: false,
        binary: "rtk",
        detail: "RTK session savings are not wired for this dashboard context.",
        startedAt: new Date(0).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }
  return { status: 200, body: publicSavingsSnapshot(snapshot) };
  // === END_BLOCK_RTK_SAVINGS_ROUTE ===
}
