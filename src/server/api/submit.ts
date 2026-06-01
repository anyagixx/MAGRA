// === MODULE_CONTRACT ===
// FILE: src/server/api/submit.ts
// VERSION: 1.0.0
// PURPOSE: Accept dashboard prompt submissions with structured attachments and route them into live loop submit path.
// SCOPE: Submit body parsing, attachment validation, HTTP response mapping, and audit metadata.
// DEPENDS: M-DASHBOARD-ATTACHMENT-TRANSPORT,M-REASONIX-BASE
// LINKS: docs/modules/M-DASHBOARD-ATTACHMENT-TRANSPORT.xml
// ROLE: API
// MAP_MODE: EXPORTS
// START_MODULE_CONTRACT
// END_MODULE_CONTRACT
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Exports: handleSubmit
// Locals: parseBody, parseAttachments
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Added structured dashboard attachment parsing and validation for submit API.
// === END_CHANGE_SUMMARY ===

import type { DashboardAttachment, DashboardContext } from "../context.js";
import type { ApiResult } from "../router.js";

interface SubmitBody {
  prompt?: unknown;
  attachments?: unknown;
}

function parseBody(raw: string): SubmitBody {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as SubmitBody) : {};
  } catch {
    return {};
  }
}

function parseAttachments(value: unknown): DashboardAttachment[] | null {
  if (value == null) return [];
  if (!Array.isArray(value)) return null;
  const out: DashboardAttachment[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const candidate = item as Record<string, unknown>;
    if (
      (candidate.kind !== "file" && candidate.kind !== "image") ||
      typeof candidate.id !== "string" ||
      typeof candidate.name !== "string" ||
      typeof candidate.path !== "string" ||
      typeof candidate.size !== "number"
    ) {
      return null;
    }
    out.push({
      id: candidate.id,
      kind: candidate.kind,
      name: candidate.name,
      path: candidate.path,
      size: candidate.size,
      mimeType: typeof candidate.mimeType === "string" ? candidate.mimeType : undefined,
      preview: typeof candidate.preview === "string" ? candidate.preview : undefined,
      excerpt: typeof candidate.excerpt === "string" ? candidate.excerpt : undefined,
      dataUrl: typeof candidate.dataUrl === "string" ? candidate.dataUrl : undefined,
      relativeToWorkspace:
        typeof candidate.relativeToWorkspace === "boolean"
          ? candidate.relativeToWorkspace
          : undefined,
    });
  }
  return out;
}

export async function handleSubmit(
  method: string,
  _rest: string[],
  body: string,
  ctx: DashboardContext,
): Promise<ApiResult> {
  if (method !== "POST") {
    return { status: 405, body: { error: "POST only" } };
  }
  if (!ctx.submitPrompt) {
    return {
      status: 503,
      body: {
        error:
          "submit requires an attached dashboard session — open `/dashboard` from inside `magra code` or `magra chat`.",
      },
    };
  }
  const { prompt, attachments: rawAttachments } = parseBody(body);
  if (typeof prompt !== "string" || !prompt.trim()) {
    return { status: 400, body: { error: "prompt (non-empty string) required" } };
  }
  const attachments = parseAttachments(rawAttachments);
  if (attachments === null) {
    return { status: 400, body: { error: "attachments must be a valid attachment array" } };
  }
  const result = ctx.submitPrompt(prompt, attachments);
  if (!result.accepted) {
    return {
      status: 409,
      body: { accepted: false, reason: result.reason ?? "loop is busy" },
    };
  }
  ctx.audit?.({
    ts: Date.now(),
    action: "submit-prompt",
    payload: { length: prompt.length, attachmentCount: attachments.length },
  });
  return { status: 202, body: { accepted: true } };
}
