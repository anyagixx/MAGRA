// === MODULE_CONTRACT ===
// FILE: dashboard/src/ui/composer.tsx
// VERSION: 1.0.0
// PURPOSE: Render MAGRA dashboard composer with slash, mention, and attachment workflows.
// SCOPE: Draft editing, slash suggestions, @-mention picker, file/image attachments, drag-drop attachment support, and send controls.
// DEPENDS: M-REASONIX-BASE,M-WEB-COMPOSER-ATTACHMENTS
// LINKS: docs/modules/M-WEB-COMPOSER-ATTACHMENTS.xml
// ROLE: UI
// MAP_MODE: EXPORTS
// START_MODULE_CONTRACT
// END_MODULE_CONTRACT
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Exports: ModeSwitch, buildAttachment, Composer
// Locals: slashIcon, parentOfAtQuery, atIcon, guessMimeType, getFileExtension, readTextAttachmentPreview, Popup, ModelEffortMenu
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Added Wave-A attachment chips, image previews, and picker-created attachment objects.
// Added bounded text preview extraction and shared attachment builder for picker and drag-drop flows.
// Clarified unsupported image attachment hint as a vision-model requirement.
// === END_CHANGE_SUMMARY ===

import {
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type React from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { t, type TKey } from "../i18n";
import { I } from "../icons";
import type { AttachmentItem } from "../protocol";
import { invoke, isWebRuntime } from "../lib/tauri-bridge";
import { fmtElapsed } from "./live";
import { Shortcut } from "./shortcut";

export type ReasoningEffort = "low" | "medium" | "high" | "max";
export type EditMode = "review" | "auto" | "yolo" | "plan";

type ModeEntry = { k: EditMode; label: TKey; icon: React.ReactNode; hint: TKey };

const EFFORTS: readonly ReasoningEffort[] = ["low", "medium", "high", "max"];

const MODE_INFO: ModeEntry[] = [
  { k: "plan", label: "editMode.plan", icon: <I.list size={11} />, hint: "editMode.planHint" },
  { k: "review", label: "editMode.review", icon: <I.shield size={11} />, hint: "editMode.reviewHint" },
  { k: "auto", label: "editMode.auto", icon: <I.zap size={11} />, hint: "editMode.autoHint" },
  { k: "yolo", label: "editMode.yolo", icon: <I.warn size={11} />, hint: "editMode.yoloHint" },
];

export function ModeSwitch({
  mode,
  onChange,
}: {
  mode: EditMode;
  onChange: (m: EditMode) => void;
}) {
  return (
    <div className="mode-switch" data-mode={mode}>
      {MODE_INFO.map((m) => (
        <button
          key={m.k}
          type="button"
          className="ms-seg"
          data-on={mode === m.k}
          data-k={m.k}
          onClick={() => onChange(m.k)}
          title={t(m.hint)}
        >
          {m.icon}
          <span>{t(m.label)}</span>
        </button>
      ))}
    </div>
  );
}

export type SlashCmd = {
  cmd: string;
  desc: string;
  run: () => void;
  kb?: string;
  insertOnly?: boolean;
};
export type MentionItem = {
  name: string;
  kind: "file" | "dir" | "url" | "agent" | "clip";
  desc?: string;
};

export type ComposerAttachment = AttachmentItem;

const TEXT_ATTACHMENT_PREVIEW_LIMIT = 4000;
const TEXT_ATTACHMENT_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".css",
  ".html",
  ".xml",
  ".yml",
  ".yaml",
  ".toml",
  ".sh",
  ".py",
  ".rs",
  ".go",
  ".java",
]);

export type Chip =
  | { kind: "at"; label: string }
  | { kind: "slash"; label: string };

type Popup =
  | { kind: "slash"; query: string }
  | { kind: "at"; query: string; nonce: number }
  | null;

function slashIcon(cmd: string) {
  const m: Record<string, React.ReactNode> = {
    "/clear": <I.x size={12} />,
    "/new": <I.plus size={12} />,
    "/abort": <I.stop size={12} />,
    "/copy": <I.layers size={12} />,
    "/export": <I.download size={12} />,
    "/model": <I.cpu size={12} />,
    "/theme": <I.sun size={12} />,
    "/lang": <I.globe size={12} />,
  };
  return m[cmd] || <I.slash size={12} />;
}

/** Parent dir of the current @ query, with trailing slash. `null` = no parent to show (at workspace root). */
function parentOfAtQuery(query: string): string | null {
  const normalized = query.replace(/\\/g, "/");
  const trailingSlash = normalized.endsWith("/");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash < 0) return null;
  const dirContext = trailingSlash ? normalized.slice(0, -1) : normalized.slice(0, lastSlash);
  if (!dirContext) return null;
  const parentIdx = dirContext.lastIndexOf("/");
  return parentIdx >= 0 ? `${dirContext.slice(0, parentIdx)}/` : "";
}

function atIcon(k: MentionItem["kind"]) {
  if (k === "file") return <I.file size={12} />;
  if (k === "dir") return <I.folder size={12} />;
  if (k === "url") return <I.globe size={12} />;
  if (k === "agent") return <I.bot size={12} />;
  if (k === "clip") return <I.layers size={12} />;
  return <I.at size={12} />;
}

function guessMimeType(path: string, kind: "file" | "image"): string | undefined {
  const lower = path.toLowerCase();
  if (kind === "image") {
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".svg")) return "image/svg+xml";
  }
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "text/typescript";
  if (lower.endsWith(".js") || lower.endsWith(".jsx")) return "text/javascript";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".css")) return "text/css";
  if (lower.endsWith(".html")) return "text/html";
  if (lower.endsWith(".xml")) return "application/xml";
  return undefined;
}

function getFileExtension(path: string): string {
  const slash = path.lastIndexOf("/");
  const dot = path.lastIndexOf(".");
  if (dot <= slash) return "";
  return path.slice(dot).toLowerCase();
}

async function readTextAttachmentPreview(path: string): Promise<{ excerpt?: string; size: number }> {
  try {
    const content = (await invoke("read_text_file", { path })) as string;
    const excerpt =
      content.length > TEXT_ATTACHMENT_PREVIEW_LIMIT
        ? `${content.slice(0, TEXT_ATTACHMENT_PREVIEW_LIMIT)}\n… (truncated ${
            content.length - TEXT_ATTACHMENT_PREVIEW_LIMIT
          } chars)`
        : content;
    return { excerpt, size: content.length };
  } catch {
    return { size: 0 };
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

export async function buildAttachment(
  picked: string,
  workspaceDir: string | undefined,
  kind: "file" | "image",
  file?: File,
): Promise<ComposerAttachment> {
  const normalizedWorkspace = workspaceDir?.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedPath = picked.replace(/\\/g, "/");
  const relative =
    normalizedWorkspace &&
    (normalizedPath === normalizedWorkspace || normalizedPath.startsWith(`${normalizedWorkspace}/`))
      ? normalizedPath.slice(normalizedWorkspace.length).replace(/^\/+/, "") || "."
      : null;
  let excerpt: string | undefined;
  let preview: string | undefined;
  let size = 0;
  if (kind === "file") {
    const ext = getFileExtension(normalizedPath);
    if (file) {
      size = file.size;
      const mimeType = file.type || guessMimeType(normalizedPath, kind);
      if ((mimeType ?? "").startsWith("text/") || TEXT_ATTACHMENT_EXTENSIONS.has(ext)) {
        try {
          const content = await file.text();
          excerpt =
            content.length > TEXT_ATTACHMENT_PREVIEW_LIMIT
              ? `${content.slice(0, TEXT_ATTACHMENT_PREVIEW_LIMIT)}\n… (truncated ${
                  content.length - TEXT_ATTACHMENT_PREVIEW_LIMIT
                } chars)`
              : content;
        } catch {
          excerpt = `Attached file: ${relative ?? normalizedPath}`;
        }
      } else {
        excerpt = `Attached file: ${relative ?? normalizedPath}`;
      }
    } else if (TEXT_ATTACHMENT_EXTENSIONS.has(ext)) {
      const previewData = await readTextAttachmentPreview(picked);
      excerpt = previewData.excerpt;
      size = previewData.size;
    } else {
      excerpt = `Attached file: ${relative ?? normalizedPath}`;
    }
  }
  if (kind === "image") {
    if (file) {
      size = file.size;
      preview = await fileToDataUrl(file);
    } else {
      preview = `file://${picked}`;
    }
  }
  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    name: relative ?? normalizedPath.split("/").pop() ?? normalizedPath,
    path: relative ?? normalizedPath,
    size,
    mimeType: file?.type || guessMimeType(normalizedPath, kind),
    preview,
    excerpt,
    dataUrl: kind === "image" ? preview : undefined,
    relativeToWorkspace: relative !== null,
  };
}

export function Composer({
  draft,
  setDraft,
  onSend,
  onAbort,
  disabled,
  busy,
  busyLabel,
  busyElapsedMs,
  modelLabel,
  modelSupportsImageInput = true,
  reasoningEffort,
  onModelChange,
  onEffortChange,
  editMode,
  onEditModeChange,
  textareaRef,
  slashCommands,
  onMentionQuery,
  onMentionPreview,
  onMentionPicked,
  mentionResults,
  workspaceDir,
  attachments = [],
  onAttachmentsChange = () => {},
  queuedSends,
  onQueueWhileBusy,
  onDequeueSend,
}: {
  draft: string;
  setDraft: (s: string) => void;
  onSend: () => void;
  onAbort: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** Replaces the hint-row left side while the agent is running — typically "Reasoning" or "Skill · <name>". */
  busyLabel?: string;
  busyElapsedMs?: number;
  modelLabel: string;
  modelSupportsImageInput?: boolean;
  reasoningEffort: ReasoningEffort;
  onModelChange: (model: string) => void;
  onEffortChange: (effort: ReasoningEffort) => void;
  editMode: EditMode;
  onEditModeChange: (mode: EditMode) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  slashCommands: SlashCmd[];
  onMentionQuery?: (q: string, nonce: number) => void;
  onMentionPreview?: (path: string, nonce: number) => void;
  onMentionPicked?: (path: string) => void;
  mentionResults?: { nonce: number; query: string; results: string[] } | null;
  workspaceDir?: string;
  attachments?: ComposerAttachment[];
  onAttachmentsChange?: (attachments: ComposerAttachment[]) => void;
  /** Messages typed while busy=true; rendered as removable chips above the textarea and auto-drained FIFO on turn-complete. */
  queuedSends?: string[];
  /** Called when the user presses Enter while busy with a non-empty draft. Owns clearing the draft. */
  onQueueWhileBusy?: (text: string) => void;
  onDequeueSend?: (index: number) => void;
}) {
  const [chips, setChips] = useState<Chip[]>([]);
  const [popup, setPopup] = useState<Popup>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const nonceRef = useRef(0);
  const modelWrapRef = useRef<HTMLDivElement>(null);
  // macOS Chinese IME fires compositionend before the confirm keydown.
  const composingRef = useRef(false);
  const compositionEndedAtRef = useRef(0);

  // Programmatic draft transitions to "/" (e.g. /help suggestion in EmptyState, #929) must open the slash popup, since handleChange only fires on actual user input.
  const prevDraftRef = useRef(draft);
  useEffect(() => {
    const prev = prevDraftRef.current;
    prevDraftRef.current = draft;
    if (draft === "/" && prev !== "/") {
      setPopup({ kind: "slash", query: "" });
    }
  }, [draft]);

  useEffect(() => {
    if (!modelMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (
        modelWrapRef.current &&
        !modelWrapRef.current.contains(e.target as Node)
      ) {
        setModelMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [modelMenuOpen]);

  const attachFile = async (filter?: "image") => {
    try {
      const picked = await openFileDialog({
        multiple: false,
        directory: false,
        defaultPath: workspaceDir,
        filters:
          filter === "image"
            ? [
                {
                  name: t("composer.imageFilterName"),
                  extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"],
                },
              ]
            : undefined,
      });
      if (typeof picked !== "string" || !picked) return;
      const next = await buildAttachment(picked, workspaceDir, filter === "image" ? "image" : "file");
      onAttachmentsChange([...attachments, next]);
      textareaRef.current?.focus();
    } catch (err) {
      console.error("attach failed", err);
    }
  };

  const browserFileInputRef = useRef<HTMLInputElement>(null);
  const browserImageInputRef = useRef<HTMLInputElement>(null);

  const attachBrowserFile = (kind: "file" | "image") => {
    const input = kind === "image" ? browserImageInputRef.current : browserFileInputRef.current;
    input?.click();
  };

  const handleBrowserFilePicked = async (
    e: ChangeEvent<HTMLInputElement>,
    kind: "file" | "image",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const next = await buildAttachment(file.name, workspaceDir, kind, file);
      onAttachmentsChange([...attachments, next]);
      textareaRef.current?.focus();
    } catch (err) {
      console.error("browser attach failed", err);
    } finally {
      e.target.value = "";
    }
  };

  const slashItems = useMemo(() => {
    if (!popup || popup.kind !== "slash") return [];
    const q = popup.query.toLowerCase();
    if (!q) return slashCommands;
    return slashCommands.filter((c) => c.cmd.toLowerCase().includes(q));
  }, [popup, slashCommands]);

  const atItems = useMemo<MentionItem[]>(() => {
    if (!popup || popup.kind !== "at") return [];
    if (!mentionResults || mentionResults.nonce !== popup.nonce) return [];
    const base: MentionItem[] = mentionResults.results.map((path) => ({
      name: path,
      kind: path.endsWith("/") || path.endsWith("\\") ? "dir" : "file",
      desc: path,
    }));
    // "../" entry (#1019): one level up whenever the @ query is inside a subdir.
    const parent = parentOfAtQuery(popup.query);
    if (parent !== null) {
      base.unshift({
        name: "..",
        kind: "dir",
        desc: parent ? `↑ ${parent}` : `↑ ${t("composer.workspaceRoot")}`,
      });
    }
    return base;
  }, [popup, mentionResults]);

  const items =
    popup?.kind === "slash" ? slashItems : popup?.kind === "at" ? atItems : [];

  useEffect(() => {
    setActiveIdx(0);
  }, [items.length, popup?.kind]);

  useEffect(() => {
    if (!popup || popup.kind !== "at" || !onMentionQuery) return;
    onMentionQuery(popup.query, popup.nonce);
  }, [popup, onMentionQuery]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setDraft(v);
    const trail = v.match(/(^|\s)([/@])([^\s]*)$/);
    if (trail) {
      const sigil = trail[2];
      const query = trail[3] ?? "";
      if (sigil === "/") {
        setPopup({ kind: "slash", query });
      } else {
        const nonce = ++nonceRef.current;
        setPopup({ kind: "at", query, nonce });
      }
    } else if (popup) {
      setPopup(null);
    }
  };

  const dismiss = () => setPopup(null);

  const pickItem = (idx: number) => {
    const it = items[idx];
    if (!it || !popup) return;
    if (popup.kind === "slash") {
      const cmd = (it as SlashCmd).cmd;
      const insertOnly = (it as SlashCmd).insertOnly === true;
      if (insertOnly) {
        const next = draft.replace(/[/@][^\s]*$/, "").trimEnd();
        setDraft(next ? `${next} ${cmd} ` : `${cmd} `);
        setChips((c) => [...c, { kind: "slash", label: cmd.replace(/^\//, "") }]);
      } else {
        const next = draft.replace(/[/@][^\s]*$/, "").trimEnd();
        setDraft(next);
        setChips((c) => [...c, { kind: "slash", label: cmd.replace(/^\//, "") }]);
        (it as SlashCmd).run();
      }
    } else {
      const mention = it as MentionItem;
      if (mention.name === "..") {
        const parent = parentOfAtQuery(popup.query) ?? "";
        const next = draft.replace(/[@][^\s]*$/, `@${parent}`);
        setDraft(next);
        const nonce = ++nonceRef.current;
        setPopup({ kind: "at", query: parent, nonce });
        textareaRef.current?.focus();
        return;
      }
      const next = draft.replace(/[/@][^\s]*$/, "").trimEnd();
      setDraft(next ? `${next} @${mention.name} ` : `@${mention.name} `);
      setChips((c) => [...c, { kind: "at", label: mention.name }]);
      onMentionPicked?.(mention.name);
    }
    setPopup(null);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (popup) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (items.length ? (i + 1) % items.length : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) =>
          items.length ? (i - 1 + items.length) % items.length : 0,
        );
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
        return;
      }
      if (e.key === "Tab" && popup.kind === "at" && items.length > 0) {
        // Tab on a directory enters it — replaces `@src` with `@src/`
        // and re-queries so the popup shows that directory's children.
        // `..` is the synthetic parent-dir entry (#1019); same shape
        // but rewrites to the parent path.
        const it = items[activeIdx];
        if (it && (it as MentionItem).kind === "dir") {
          e.preventDefault();
          const mention = it as MentionItem;
          if (mention.name === "..") {
            const parent = parentOfAtQuery(popup.query) ?? "";
            const next = draft.replace(/[@][^\s]*$/, `@${parent}`);
            setDraft(next);
            const nonce = ++nonceRef.current;
            setPopup({ kind: "at", query: parent, nonce });
            return;
          }
          const dirPath = mention.name.replace(/\/+$/, "");
          const next = draft.replace(/[@][^\s]*$/, `@${dirPath}/`);
          setDraft(next);
          const nonce = ++nonceRef.current;
          setPopup({ kind: "at", query: `${dirPath}/`, nonce });
          return;
        }
      }
      if (e.key === "Enter") {
        if (items.length > 0) {
          e.preventDefault();
          pickItem(activeIdx);
          return;
        }
        dismiss();
      }
    }
    if (composingRef.current || Date.now() - compositionEndedAtRef.current < 50) return;
    if (e.key === "Enter" && !e.shiftKey && !popup) {
      e.preventDefault();
      if (busy) {
        const text = draft.trim();
        if (text && onQueueWhileBusy) {
          onQueueWhileBusy(text);
          setChips([]);
        }
      } else if (!disabled && (draft.trim() || attachments.length > 0)) {
        onSend();
        setChips([]);
      }
    }
  };

  return (
    <div className="composer-wrap">
      <div className="composer-inner">
        {queuedSends && queuedSends.length > 0 ? (
          <div className="composer-queued">
            <span className="composer-queued-label">
              {t("composer.queueCount", { count: queuedSends.length })}
            </span>
            {queuedSends.map((text, i) => (
              <span key={i} className="composer-queue-chip" title={text}>
                <span className="text">{text}</span>
                {onDequeueSend ? (
                  <span className="x" onClick={() => onDequeueSend(i)}>
                    <I.x size={10} />
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}

        <div className="hint-row">
          {busy && busyLabel ? (
            <>
              <span className="composer-busy-status">
                <span className="composer-busy-pip" />
                <span className="composer-busy-label">{busyLabel}</span>
                <span className="composer-busy-time">
                  {fmtElapsed(busyElapsedMs ?? 0)}
                </span>
              </span>
              <span className="grow" />
              <ModeSwitch mode={editMode} onChange={onEditModeChange} />
              <span className="hint-sep" />
              <span>
                <Shortcut keys={["enter"]} /> {t("composer.queue")} &nbsp;·&nbsp;{" "}
                <Shortcut keys={["esc"]} /> {t("composer.interrupt")}
              </span>
            </>
          ) : (
            <>
              <span>
                <Shortcut keys={["/"]} /> {t("composer.commands")} &nbsp;·&nbsp;{" "}
                <Shortcut keys={["@"]} /> {t("composer.mentionFiles")}
                &nbsp;·&nbsp; <Shortcut keys={["mod", "K"]} /> {t("composer.commandPalette")}
              </span>
              <span className="grow" />
              <ModeSwitch mode={editMode} onChange={onEditModeChange} />
              <span className="hint-sep" />
              <span>
                <Shortcut keys={["enter"]} /> {t("composer.send")} &nbsp;{" "}
                <Shortcut keys={["shift", "enter"]} /> {t("composer.newline")}
              </span>
            </>
          )}
        </div>

        <div className="composer">
          {attachments.length > 0 ? (
            <div className="composer-tags composer-attachments">
              {attachments.map((attachment) => (
                <span key={attachment.id} className={`chip attachment ${attachment.kind}`}>
                  {attachment.kind === "image" ? <I.image size={11} /> : <I.paperclip size={11} />}
                  {attachment.preview ? (
                    <span className="attachment-preview" aria-hidden="true">
                      <img src={attachment.preview} alt="" />
                    </span>
                  ) : null}
                  <span>{attachment.name}</span>
                  <span
                    className="x"
                    onClick={() =>
                      onAttachmentsChange(attachments.filter((item) => item.id !== attachment.id))
                    }
                  >
                    <I.x size={10} />
                  </span>
                </span>
              ))}
              {attachments.some((attachment) => attachment.kind === "image") && !modelSupportsImageInput ? (
                <span
                  className="chip attachment warning"
                  title="Current model route does not support image input; switch to a vision-capable model before sending images."
                >
                  <I.warn size={11} />
                  <span>vision model required</span>
                </span>
              ) : null}
            </div>
          ) : null}

          {chips.length > 0 ? (
            <div className="composer-tags">
              {chips.map((c, i) => (
                <span key={i} className={`chip ${c.kind}`}>
                  {c.kind === "slash" ? (
                    <I.slash size={11} />
                  ) : (
                    <I.at size={11} />
                  )}
                  <span>{c.label}</span>
                  <span
                    className="x"
                    onClick={() =>
                      setChips((cs) => cs.filter((_, j) => j !== i))
                    }
                  >
                    <I.x size={10} />
                  </span>
                </span>
              ))}
            </div>
          ) : null}

          <input
            ref={browserFileInputRef}
            type="file"
            style={{ display: "none" }}
            onChange={(e) => void handleBrowserFilePicked(e, "file")}
          />
          <input
            ref={browserImageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            style={{ display: "none" }}
            onChange={(e) => void handleBrowserFilePicked(e, "image")}
          />

          <textarea
            ref={textareaRef}
            value={draft}
            placeholder={t("composer.placeholder")}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
              compositionEndedAtRef.current = Date.now();
            }}
            rows={2}
            disabled={disabled}
          />

          <div className="composer-foot">
            <button
              type="button"
              className="cf-btn"
              title={t("composer.insertFile")}
              onClick={() =>
                isWebRuntime ? attachBrowserFile("file") : void attachFile()
              }
            >
              <span className="ico">
                <I.paperclip size={14} />
              </span>
            </button>
            <button
              type="button"
              className="cf-btn"
              title={t("composer.insertImage")}
              onClick={() =>
                isWebRuntime ? attachBrowserFile("image") : void attachFile("image")
              }
            >
              <span className="ico">
                <I.image size={14} />
              </span>
            </button>
            <button
              type="button"
              className="cf-btn"
              onClick={() => setPopup({ kind: "slash", query: "" })}
            >
              <span className="ico">
                <I.slash size={14} />
              </span>
              <span className="label">{t("composer.commandsLabel")}</span>
            </button>
            <button
              type="button"
              className="cf-btn"
              onClick={() => {
                const nonce = ++nonceRef.current;
                setPopup({ kind: "at", query: "", nonce });
              }}
            >
              <span className="ico">
                <I.at size={14} />
              </span>
              <span className="label">{t("composer.mentionLabel")}</span>
            </button>

            <span className="grow" />

            <div ref={modelWrapRef} style={{ position: "relative" }}>
              <button
                type="button"
                className="model-pill"
                onClick={() => setModelMenuOpen((v) => !v)}
                title={t("composer.switchModel")}
              >
                <I.brain size={12} />
                <span>{modelLabel}</span>
                <span className="badge">{reasoningEffort}</span>
                <I.chev size={10} />
              </button>
              {modelMenuOpen ? (
                <ModelEffortMenu
                  modelLabel={modelLabel}
                  currentEffort={reasoningEffort}
                  onPickModel={(m) => {
                    onModelChange(m);
                    setModelMenuOpen(false);
                  }}
                  onPickEffort={(e) => {
                    onEffortChange(e);
                    setModelMenuOpen(false);
                  }}
                />
              ) : null}
            </div>
            {busy ? (
              <button
                type="button"
                className="send-btn"
                style={{ background: "var(--danger)" }}
                onClick={onAbort}
                title={t("composer.interrupt")}
              >
                <I.stop size={14} />
              </button>
            ) : (
              <button
                type="button"
                className="send-btn"
                 disabled={disabled || (!draft.trim() && attachments.length === 0)}
                 onClick={() => {
                   if (!disabled && (draft.trim() || attachments.length > 0)) {
                     onSend();
                     setChips([]);
                   }
                 }}

              >
                <I.send size={14} />
              </button>
            )}
          </div>

          {popup ? (
            <Popup
              kind={popup.kind}
              items={items}
              activeIdx={activeIdx}
              onPick={(i) => pickItem(i)}
              onClose={dismiss}
              onHover={(i, item) => {
                setActiveIdx(i);
                if (popup.kind === "at" && onMentionPreview) {
                  const path = (item as MentionItem).name;
                  onMentionPreview(path, popup.nonce);
                }
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Popup({
  kind,
  items,
  activeIdx,
  onPick,
  onClose,
  onHover,
}: {
  kind: "slash" | "at";
  items: (SlashCmd | MentionItem)[];
  activeIdx: number;
  onPick: (i: number) => void;
  onClose: () => void;
  onHover: (i: number, item: SlashCmd | MentionItem) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-active="true"]`);
      el?.scrollIntoView({ block: "nearest" });
    });
  }, [activeIdx]);

  return (
    <div className="popup" onMouseDown={(e) => e.preventDefault()}>
      <div className="ph">
        <span className="tok">{kind === "slash" ? "/" : "@"}</span>
        <span>
          {kind === "slash"
            ? t("composer.slashHeader")
            : t("composer.atHeader")}
        </span>
        <span className="grow" />
        <span style={{ cursor: "pointer" }} onClick={onClose}>
          <I.x size={11} />
        </span>
      </div>
      <div className="popup-list" ref={listRef}>
        {items.length === 0 ? (
          <div
            style={{
              padding: "12px 8px",
              fontSize: 11.5,
              color: "var(--muted-2)",
              fontFamily: "Geist Mono, monospace",
            }}
          >
            {t("composer.noMatches")}
          </div>
        ) : null}
        {items.map((it, i) => (
          <div
            key={i}
            className="popup-item"
            data-active={i === activeIdx}
            onClick={() => onPick(i)}
            onMouseEnter={() => onHover(i, it)}
          >
            <span className="ico">
              {kind === "slash"
                ? slashIcon((it as SlashCmd).cmd)
                : atIcon((it as MentionItem).kind)}
            </span>
            <div className="nm">
              {kind === "slash" ? (
                <>
                  <span className="cmd">{(it as SlashCmd).cmd}</span>
                  <span className="desc">{(it as SlashCmd).desc}</span>
                </>
              ) : (
                <>
                  <span>{(it as MentionItem).name}</span>
                  {(it as MentionItem).desc ? (
                    <div className="desc">{(it as MentionItem).desc}</div>
                  ) : null}
                </>
              )}
            </div>
            <span className="kb">
              {kind === "slash" ? ((it as SlashCmd).kb ?? "") : ""}
            </span>
          </div>
        ))}
      </div>
      <div className="popup-foot">
        <span>
          <Shortcut keys={["updown"]} /> {t("composer.select")}
        </span>
        <span>
          <Shortcut keys={["enter"]} /> {t("composer.confirm")}
        </span>
        <span>
          <Shortcut keys={["esc"]} /> {t("composer.close")}
        </span>
      </div>
    </div>
  );
}

const KNOWN_MODELS: readonly string[] = ["deepseek-v4-flash", "deepseek-v4-pro"];

function ModelEffortMenu({
  modelLabel,
  currentEffort,
  onPickModel,
  onPickEffort,
}: {
  modelLabel: string;
  currentEffort: ReasoningEffort;
  onPickModel: (model: string) => void;
  onPickEffort: (effort: ReasoningEffort) => void;
}) {
  const [draft, setDraft] = useState(modelLabel);
  return (
    <div
      className="popup"
      style={{
        bottom: "calc(100% + 6px)",
        left: "auto",
        right: 0,
        width: 280,
        position: "absolute",
      }}
    >
      <div className="ph">
        <span className="tok">M</span>
        <span>{t("composer.switchModel")}</span>
      </div>
      <div className="popup-list">
        {KNOWN_MODELS.map((m) => (
          <div
            key={m}
            className="popup-item"
            data-active={m === modelLabel}
            onClick={() => onPickModel(m)}
          >
            <span className="ico">
              <I.brain size={12} />
            </span>
            <div className="nm">
              <span className="cmd">{m}</span>
            </div>
          </div>
        ))}
        <div style={{ padding: "6px 8px", display: "flex", gap: 6 }}>
          <input
            className="field mono"
            style={{ flex: 1 }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="custom model id"
          />
          <button
            type="button"
            className="btn"
            disabled={!draft.trim() || draft.trim() === modelLabel}
            onClick={() => onPickModel(draft.trim())}
          >
            {t("composer.confirm")}
          </button>
        </div>
      </div>
      <div className="ph" style={{ marginTop: 4 }}>
        <span className="tok">E</span>
        <span>{t("composer.switchEffort")}</span>
      </div>
      <div className="popup-list">
        {EFFORTS.map((e) => (
          <div
            key={e}
            className="popup-item"
            data-active={e === currentEffort}
            onClick={() => onPickEffort(e)}
          >
            <span className="ico">
              <I.cpu size={12} />
            </span>
            <div className="nm">
              <span className="cmd">{e}</span>
              <div className="desc">{t(`effort.${e}Desc` as TKey)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
