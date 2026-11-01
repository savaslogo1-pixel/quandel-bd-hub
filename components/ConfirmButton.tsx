"use client";

import { useState } from "react";

/** Two-step destructive button for use inside a <form action={serverAction}>. */
export function ConfirmButton({ label, confirmLabel }: { label: string; confirmLabel: string }) {
  const [armed, setArmed] = useState(false);
  return armed ? (
    <button type="submit" className="btn btn-danger">{confirmLabel}</button>
  ) : (
    <button type="button" className="btn btn-danger" onClick={() => setArmed(true)}>{label}</button>
  );
}
