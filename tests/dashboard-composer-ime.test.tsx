// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
// biome-ignore lint/style/useImportType: The TSX transform needs React in scope.
import React, { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

import { Composer } from "../dashboard/src/ui/composer";

afterEach(() => {
  cleanup();
});

function renderComposer(props: Partial<React.ComponentProps<typeof Composer>> = {}) {
  const onSend = props.onSend ?? vi.fn();
  const onQueueWhileBusy = props.onQueueWhileBusy ?? vi.fn();

  function Harness() {
    const [draft, setDraft] = useState(props.draft ?? "ni");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    return (
      <Composer
        draft={draft}
        setDraft={setDraft}
        onSend={onSend}
        onAbort={props.onAbort ?? vi.fn()}
        disabled={props.disabled}
        busy={props.busy}
        busyLabel={props.busyLabel}
        busyElapsedMs={props.busyElapsedMs}
        modelLabel={props.modelLabel ?? "deepseek-v4-flash"}
        modelSupportsImageInput={props.modelSupportsImageInput ?? true}
        reasoningEffort={props.reasoningEffort ?? "high"}
        onModelChange={props.onModelChange ?? vi.fn()}
        onEffortChange={props.onEffortChange ?? vi.fn()}
        editMode={props.editMode ?? "review"}
        onEditModeChange={props.onEditModeChange ?? vi.fn()}
        textareaRef={textareaRef}
        slashCommands={props.slashCommands ?? []}
        onMentionQuery={props.onMentionQuery}
        onMentionPreview={props.onMentionPreview}
        onMentionPicked={props.onMentionPicked}
        mentionResults={props.mentionResults}
        workspaceDir={props.workspaceDir}
        attachments={props.attachments}
        onAttachmentsChange={props.onAttachmentsChange}
        queuedSends={props.queuedSends}
        onQueueWhileBusy={onQueueWhileBusy}
        onDequeueSend={props.onDequeueSend}
      />
    );
  }

  render(<Harness />);
  return {
    textarea: screen.getByPlaceholderText(/Type a prompt|输入提示词/) as HTMLTextAreaElement,
    onSend,
    onQueueWhileBusy,
  };
}

describe("dashboard Composer IME handling (#1669)", () => {
  it("does not send when Enter confirms an IME composition", () => {
    const { textarea, onSend } = renderComposer();

    fireEvent.compositionStart(textarea);
    fireEvent.compositionEnd(textarea);
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("shows vision-model-required hint for image attachments on non-image-capable model", () => {
    renderComposer({
      attachments: [
        {
          id: "img-1",
          kind: "image",
          name: "shot.png",
          path: "shot.png",
          size: 12,
          dataUrl: "data:image/png;base64,AAAA",
        },
      ],
      modelSupportsImageInput: false,
    });

    expect(screen.getByText("vision model required")).toBeTruthy();
  });
});
