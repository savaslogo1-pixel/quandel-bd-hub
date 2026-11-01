// Helpers for reading HTML form posts in server actions.

export type FormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

export const str = (fd: FormData, k: string): string | null => {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
};

export const int = (fd: FormData, k: string): number | null => {
  const v = str(fd, k);
  if (v == null) return null;
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isInteger(n) ? n : NaN;
};

/** Money/decimal fields: accepts "$1,250,000". Returns string for Prisma Decimal. */
export const dec = (fd: FormData, k: string): string | null => {
  const v = str(fd, k);
  if (v == null) return null;
  const c = v.replace(/[$,\s]/g, "");
  return Number.isNaN(Number(c)) ? "NaN" : c;
};

/** <input type="date"> value → UTC-midnight Date. */
export const date = (fd: FormData, k: string): Date | null => {
  const v = str(fd, k);
  if (!v) return null;
  const d = new Date(v + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
};

export const bool = (fd: FormData, k: string): boolean => fd.get(k) === "on";

export const all = (fd: FormData, k: string): string[] =>
  fd.getAll(k).filter((v): v is string => typeof v === "string" && v !== "");

/** Collect validation problems for numeric fields that failed to parse. */
export function badNumbers(fields: Record<string, number | string | null>): Record<string, string> {
  const e: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if ((typeof v === "number" && Number.isNaN(v)) || v === "NaN") e[k] = "Enter a number";
  }
  return e;
}
