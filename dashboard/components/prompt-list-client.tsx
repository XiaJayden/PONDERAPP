"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePromptById, reorderPrompts } from "@/app/dashboard/prompts/actions";

export type PromptRow = {
  id: string | number;
  prompt_text: string;
  explanation_text: string | null;
  prompt_date: string;
  theme: string | null;
  display_order: number | null;
  created_at?: string;
};

function formatISODateUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysToISODate(dateYYYYMMDD: string, days: number): string {
  const base = new Date(`${dateYYYYMMDD}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return dateYYYYMMDD;
  const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return formatISODateUTC(next);
}

function sortByDisplayOrder(prompts: PromptRow[]) {
  return [...prompts].sort((a, b) => {
    const ao = a.display_order ?? Number.POSITIVE_INFINITY;
    const bo = b.display_order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    if (a.prompt_date !== b.prompt_date) return a.prompt_date.localeCompare(b.prompt_date);
    return String(a.id).localeCompare(String(b.id));
  });
}

function moveBefore<T>(arr: T[], fromIdx: number, toIdx: number) {
  if (fromIdx === toIdx) return arr;
  const copy = [...arr];
  const [item] = copy.splice(fromIdx, 1);
  copy.splice(toIdx, 0, item);
  return copy;
}

export function PromptListClient({ initialPrompts }: { initialPrompts: PromptRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [prompts, setPrompts] = useState(() => sortByDisplayOrder(initialPrompts));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const baseDate = useMemo(() => {
    const dates = prompts.map((p) => p.prompt_date).filter(Boolean).sort();
    return dates[0] ?? formatISODateUTC(new Date());
  }, [prompts]);

  async function commitOrder(next: PromptRow[]) {
    setPrompts(next);
    startTransition(async () => {
      await reorderPrompts(next.map((p) => String(p.id)));
      router.refresh();
    });
  }

  function onDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    try {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
    } catch {
      // ignore
    }
  }

  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    if (overId !== id) setOverId(id);
  }

  function onDrop(e: React.DragEvent, id: string) {
    e.preventDefault();
    const dragged = draggingId ?? (() => {
      try {
        return e.dataTransfer.getData("text/plain") || null;
      } catch {
        return null;
      }
    })();
    if (!dragged || dragged === id) return;

    const fromIdx = prompts.findIndex((p) => String(p.id) === dragged);
    const toIdx = prompts.findIndex((p) => String(p.id) === id);
    if (fromIdx === -1 || toIdx === -1) return;

    const next = moveBefore(prompts, fromIdx, toIdx);
    void commitOrder(next);
  }

  function onDragEnd() {
    setDraggingId(null);
    setOverId(null);
  }

  async function onDelete(id: string) {
    startTransition(async () => {
      await deletePromptById(id);
      setPrompts((prev) => prev.filter((p) => String(p.id) !== id));
      router.refresh();
    });
  }

  return (
    <div className="divide-y divide-white/10">
      <div className="flex items-start justify-between gap-4 px-4 py-3">
        <div>
          <div className="text-sm font-medium">Existing prompts</div>
          <div className="mt-1 text-xs text-white/60">
            Sorted by display order. Drag rows to reorder. The number badge is the position (= display_order).
          </div>
        </div>
        {isPending ? <div className="text-xs text-white/60">Saving…</div> : null}
      </div>

      {prompts.length === 0 ? (
        <div className="px-4 py-6 text-sm text-white/60">No prompts found.</div>
      ) : (
        prompts.map((p, idx) => {
          const id = String(p.id);
          const computedDate = addDaysToISODate(baseDate, idx);
          const isDragging = draggingId === id;
          const isOver = overId === id && !isDragging;

          return (
            <div
              key={id}
              draggable={!isPending}
              onDragStart={(e) => onDragStart(e, id)}
              onDragOver={(e) => onDragOver(e, id)}
              onDrop={(e) => onDrop(e, id)}
              onDragEnd={onDragEnd}
              className={[
                "flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between",
                "select-none",
                isDragging ? "opacity-60" : "",
                isOver ? "bg-white/5" : "",
              ].join(" ")}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-black">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{p.prompt_text}</div>
                    <div className="mt-1 text-xs text-white/60">
                      order={idx + 1} • date={computedDate} • id={id} • theme={p.theme ?? "—"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className="hidden cursor-grab select-none text-xs text-white/50 md:block" title="Drag to reorder">
                  ⠿
                </div>
                <Link
                  href={`/dashboard/prompts/${encodeURIComponent(id)}`}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                >
                  Edit + Preview
                </Link>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void onDelete(id)}
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/15 disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}




