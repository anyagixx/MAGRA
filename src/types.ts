// === MODULE_CONTRACT ===
// FILE: src/types.ts
// VERSION: 1.0.0
// PURPOSE: Define shared MAGRA chat, tool, and attachment transport types.
// SCOPE: Tool specs, chat messages, attachment metadata, and request options used across runtime, dashboard, and provider clients.
// DEPENDS: M-REASONIX-BASE
// LINKS: docs/modules/M-CHAT-ATTACHMENT-MODEL.xml
// ROLE: DATA
// MAP_MODE: EXPORTS
// START_MODULE_CONTRACT
// END_MODULE_CONTRACT
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Exports: JSONSchema, ToolFunctionSpec, ToolSpec, ToolCall, Role, AttachmentMetadata, ChatMessage, RawUsage, ChatRequestOptions
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Added shared attachment metadata types for dashboard transport, session replay, and image-send gating.
// === END_CHANGE_SUMMARY ===

export interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  description?: string;
  enum?: unknown[];
  [k: string]: unknown;
}

export interface ToolFunctionSpec {
  name: string;
  description: string;
  parameters: JSONSchema;
}

export interface ToolSpec {
  type: "function";
  function: ToolFunctionSpec;
}

export interface ToolCall {
  id?: string;
  type?: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export type Role = "system" | "user" | "assistant" | "tool";

export interface AttachmentMetadata {
  id: string;
  kind: "file" | "image";
  name: string;
  path: string;
  size: number;
  mimeType?: string;
  preview?: string;
  excerpt?: string;
  dataUrl?: string;
  relativeToWorkspace?: boolean;
}

export interface ChatMessage {
  role: Role;
  content?: string | null;
  attachments?: AttachmentMetadata[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  /** Must round-trip in tool-loop continuations — thinking mode 400s without it. */
  reasoning_content?: string | null;
}

export interface RawUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  /** Ollama native API: input tokens processed. */
  prompt_eval_count?: number;
  /** Ollama native API: output tokens generated. */
  eval_count?: number;
}

export interface ChatRequestOptions {
  model: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  signal?: AbortSignal;
  /** DeepSeek response_format — use { type: "json_object" } to force valid JSON. */
  responseFormat?: { type: "json_object" | "text" };
  thinking?: "enabled" | "disabled";
  reasoningEffort?: import("./config.js").ReasoningEffort;
}
