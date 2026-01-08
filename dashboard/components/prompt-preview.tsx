"use client";

import { useMemo, useState } from "react";

import { PromptPopup, type PromptPopupPrompt } from "../../components/prompts/prompt-popup";

type DailyPromptLike = {
  id: string;
  prompt_text: string;
  explanation_text: string | null;
  prompt_date: string;
  theme: string | null;
  display_order: number | null;
};

export function PromptPreview({ prompt }: { prompt: DailyPromptLike }) {
  const [open, setOpen] = useState(false);

  // PromptPopup expects the DailyPrompt shape; we match it already.
  const mapped = useMemo(() => prompt, [prompt]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black"
        >
          Open preview (modal)
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
        >
          Close
        </button>
      </div>

      <div className="text-xs text-white/60">
        This opens the real mobile modal component via <code className="rounded bg-white/10 px-1 py-0.5">react-native-web</code>.
      </div>

      <PromptPopup
        isVisible={open}
        prompt={mapped as unknown as PromptPopupPrompt}
        onClose={() => setOpen(false)}
        onRespond={() => {}}
      />
    </div>
  );
}


