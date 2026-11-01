"use client";

import { useOptimistic, useTransition } from "react";
import { toggleChecklistItem } from "./actions";

export function ChecklistItem({ id, itemKey, label, done, doneNote, disabled }: { id: string; itemKey: string; label: string; done: boolean; doneNote?: string; disabled: boolean }) {
  const [, start] = useTransition();
  const [checked, setChecked] = useOptimistic(done);
  return (
    <label className="flex items-start gap-2 border-t py-1.5 first:border-t-0" style={{ borderColor: "var(--line)" }}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4"
        style={{ accentColor: "var(--brand)" }}
        checked={checked}
        disabled={disabled}
        onChange={() => start(async () => { setChecked(!checked); await toggleChecklistItem(id, itemKey); })}
      />
      <span style={checked ? { color: "var(--muted)" } : undefined}>
        {label}
        {checked && doneNote && <span className="muted ml-1 text-xs">· {doneNote}</span>}
      </span>
    </label>
  );
}
