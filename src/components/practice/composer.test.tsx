import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { PracticeSessionApi } from "@/hooks/use-practice-session";
import type { Phase } from "@/lib/practice-machine";
import { Composer } from "./composer";

function Harness({ phase, submit, recognitionSupported = false }: { phase: Phase; submit: (t: string, s: string) => void; recognitionSupported?: boolean }) {
  const [draft, setDraft] = useState("");
  const practice = {
    state: { phase, session: { engine: "ollama" }, streamingText: "", error: null },
    recognition: {
      supported: recognitionSupported, listening: false, heard: "", error: null,
      start: vi.fn(), finish: vi.fn(), cancel: vi.fn(), clearError: vi.fn(),
    },
    tts: { supported: false, speaking: false, cancel: vi.fn() },
    micOn: true, setMicOn: vi.fn(), draft, setDraft,
    submit: async (t: string, s: string) => {
      submit(t, s);
      setDraft("");
    },
    listenNow: vi.fn(), replayLast: vi.fn(), askSimpler: vi.fn(),
  } as unknown as PracticeSessionApi;
  return (
    <TooltipProvider>
      <Composer practice={practice} />
    </TooltipProvider>
  );
}

describe("Composer — text input fallback", () => {
  it("lets the learner type and send with Enter when voice is unsupported", () => {
    const submit = vi.fn();
    render(<Harness phase="your-turn" submit={submit} />);
    expect(screen.getByText(/Voice input isn.t available in this browser/)).toBeInTheDocument();
    const box = screen.getByLabelText("Type your answer");
    fireEvent.change(box, { target: { value: "I went to Pune last week." } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(submit).toHaveBeenCalledWith("I went to Pune last week.", "typed");
  });

  it("sends with the button, and Shift+Enter does not send", () => {
    const submit = vi.fn();
    render(<Harness phase="your-turn" submit={submit} />);
    const box = screen.getByLabelText("Type your answer");
    fireEvent.change(box, { target: { value: "Hello" } });
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(submit).toHaveBeenCalledWith("Hello", "typed");
  });

  it("is disabled while the coach is thinking", () => {
    render(<Harness phase="coach-thinking" submit={vi.fn()} />);
    expect(screen.getByLabelText("Type your answer")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("shows the microphone button when voice is supported", () => {
    render(<Harness phase="your-turn" submit={vi.fn()} recognitionSupported />);
    expect(screen.getByRole("button", { name: "Start speaking" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Mute mic/ })).toBeInTheDocument();
  });
});
