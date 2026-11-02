"use client";

import { useEffect, useRef, useState } from "react";

/** Countdown for capstone presentations. */
export function Timer({ minutes }: { minutes: number }) {
  const [left, setLeft] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const t = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!running) return;
    t.current = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => { if (t.current) clearInterval(t.current); };
  }, [running]);
  const over = left < 0;
  const a = Math.abs(left);
  return (
    <div className="flex items-center gap-2">
      <span className="mono text-2xl" style={{ color: over ? "var(--bad)" : left <= 60 ? "var(--warn)" : "var(--ink)" }} aria-live="polite">
        {over && "−"}{Math.floor(a / 60)}:{String(a % 60).padStart(2, "0")}
      </span>
      <button type="button" className="btn btn-sm" onClick={() => setRunning((r) => !r)}>{running ? "Pause" : "Start"}</button>
      <button type="button" className="btn btn-sm" onClick={() => { setRunning(false); setLeft(minutes * 60); }}>Reset</button>
    </div>
  );
}
