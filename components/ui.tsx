import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="min-w-[220px] flex-1">
        <h1 className="text-[26px] font-semibold">{title}</h1>
        {sub && <p className="muted mt-0.5 max-w-[75ch]">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function CompanyTag({ code, lead }: { code: string; lead?: boolean }) {
  return (
    <span className={`co co-${code}`} title={lead ? `${code} (lead)` : code} style={lead ? { boxShadow: "0 0 0 2px var(--surface), 0 0 0 3px currentColor" } : undefined}>
      {code}
    </span>
  );
}

export function CompanyTags({ codes }: { codes: { code: string }[] }) {
  if (!codes.length) return <span className="muted">—</span>;
  return <span className="inline-flex flex-wrap gap-1">{codes.map((c) => <CompanyTag key={c.code} code={c.code} />)}</span>;
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {children}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Fact({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div>
      <div className="k">{k}</div>
      <div className="v">{children ?? "—"}</div>
    </div>
  );
}

export function Tabs({ base, current, tabs }: { base: string; current: string; tabs: [string, string][] }) {
  return (
    <nav className="tabs" aria-label="Sections">
      {tabs.map(([k, l]) => (
        <Link key={k} href={k === tabs[0][0] ? base : `${base}?tab=${k}`} aria-current={current === k ? "page" : undefined}>
          {l}
        </Link>
      ))}
    </nav>
  );
}

export function Strength({ n }: { n: number | null }) {
  if (!n) return null;
  return <span className="strength" title={`Relationship strength ${n} of 5`}>{"●".repeat(n)}{"○".repeat(5 - n)}</span>;
}

/* ───── form fields (server-rendered, uncontrolled) ───── */

type FieldBase = { name: string; label: string; hint?: string; full?: boolean; required?: boolean };

export function TextField({ name, label, hint, full, required, defaultValue, type = "text", placeholder, inputMode }: FieldBase & { defaultValue?: string | number | null; type?: string; placeholder?: string; inputMode?: "decimal" | "numeric" }) {
  return (
    <label className={`field${full ? " full" : ""}`}>
      <span>{label}{required && " *"} {hint && <span className="hint">{hint}</span>}</span>
      <input id={`f-${name}`} name={name} type={type} defaultValue={defaultValue ?? ""} required={required} placeholder={placeholder} inputMode={inputMode} />
    </label>
  );
}

export function TextArea({ name, label, hint, defaultValue }: FieldBase & { defaultValue?: string | null }) {
  return (
    <label className="field full">
      <span>{label} {hint && <span className="hint">{hint}</span>}</span>
      <textarea id={`f-${name}`} name={name} defaultValue={defaultValue ?? ""} />
    </label>
  );
}

export function SelectField({ name, label, hint, full, required, defaultValue, options, blank = "—" }: FieldBase & { defaultValue?: string | number | null; options: (string | [string, string])[]; blank?: string | null }) {
  return (
    <label className={`field${full ? " full" : ""}`}>
      <span>{label}{required && " *"} {hint && <span className="hint">{hint}</span>}</span>
      <select id={`f-${name}`} name={name} defaultValue={defaultValue == null ? "" : String(defaultValue)} required={required}>
        {blank !== null && <option value="">{blank}</option>}
        {options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o];
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </label>
  );
}

export function CheckField({ name, label, defaultChecked, full }: { name: string; label: string; defaultChecked?: boolean; full?: boolean }) {
  return (
    <label className={`check${full ? " full" : ""}`}>
      <input id={`f-${name}`} type="checkbox" name={name} defaultChecked={defaultChecked} /> {label}
    </label>
  );
}

export function CheckGroup({ name, label, options, selected, hint }: { name: string; label: string; options: [string, string][]; selected: string[]; hint?: string }) {
  return (
    <fieldset className="field full">
      <legend className="mb-1">{label} {hint && <span className="hint">{hint}</span>}</legend>
      <div className="checks">
        {options.length ? options.map(([v, l]) => (
          <label key={v}><input type="checkbox" name={name} value={v} defaultChecked={selected.includes(v)} /> {l}</label>
        )) : <span className="muted">None available</span>}
      </div>
    </fieldset>
  );
}
