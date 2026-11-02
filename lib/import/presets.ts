import presets from "@/data/import_presets.json";
import type { Defaults, Mapping } from "./orgs";

export type Preset = { id: string; label: string; sheet: string; headerRow: number; requires: string[]; mapping: Record<string, string | string[]>; defaults: Defaults; notes?: string };
export const PRESETS = presets.presets as Preset[];

export const presetFor = (headers: string[]) => PRESETS.find((p) => p.requires.every((h) => headers.includes(h))) ?? null;
export const presetForSheets = (sheets: string[]) => PRESETS.find((p) => sheets.includes(p.sheet)) ?? null;

/** Turn a preset's header-name mapping into column indexes for these headers. */
export function presetMapping(p: Preset, headers: string[]): Mapping {
  const m = {} as Mapping;
  for (const [field, h] of Object.entries(p.mapping)) {
    if (field === "notes") m.notes = (h as string[]).map((x) => headers.indexOf(x)).filter((i) => i >= 0);
    else {
      const i = headers.indexOf(h as string);
      if (i >= 0) m[field] = i;
    }
  }
  return m;
}
