import ExcelJS from "exceljs";
import { buildPreview, guessMapping, parseMoney, resolveOrgType } from "../lib/import/orgs";
import { readGrid, sheetNames } from "../lib/import/parse";

let fail = 0;
const eq = (a: unknown, b: unknown, m: string) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) { fail++; console.log("FAIL", m, JSON.stringify(a), "≠", JSON.stringify(b)); } else console.log("ok  ", m);
};
const TYPES = ["county", "city", "borough", "township", "town", "village", "school district", "intermediate unit / BOCES", "career-tech center", "community college", "municipal authority", "housing authority", "hospital / health system"];

(async () => {
  // A made-up workbook shaped like an eligible-owners list: a title row, then headers on row 3.
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Notes").addRow(["Read me"]);
  const ws = wb.addWorksheet("Owners");
  ws.addRow(["Example eligible public owners (test data)"]);
  ws.addRow([]);
  ws.addRow(["Owner Name", "Entity Type", "County", "State", "Enrollment", "Oldest Building Year", "Last GESA Year", "ESCO", "Total Debt", "Tier"]);
  ws.addRow(["Example Area School District", "School District", "Dauphin", "PA", 3200, 1958, "", "", "$12,500,000", "A"]);
  ws.addRow(["Example Township", "Twp", "Cumberland County", "Pennsylvania", "", "1972", 2011, "Example ESCO", "1.2M", "Tier B"]);
  ws.addRow(["Example Borough", "", "Lebanon", "PA", "", "", "", "", "", "C"]);
  ws.addRow(["Example Area School District", "SD", "Dauphin", "PA", 3200, 1958, "", "", "", "A"]); // duplicate in file
  ws.addRow(["Example Water Authority", "Water Authority", "York", "PA", "", "n/a", "", "", "", "Z"]);
  ws.addRow(["", "School District", "", "PA"]); // no name
  ws.addRow(["Existing Example SD", "school district", "Lancaster", "PA", 5000, 1960, 2015, "", "", "A"]);
  const buf = Buffer.from(await wb.xlsx.writeBuffer());

  eq(await sheetNames("owners.xlsx", buf), ["Notes", "Owners"], "lists sheets");
  const g = await readGrid("owners.xlsx", buf, "Owners", 3);
  eq(g.headers.length, 10, "reads headers from row 3");
  eq(g.rows.length, 7, "drops blank rows");
  const m = guessMapping(g.headers);
  eq(
    { name: m.name, orgType: m.orgType, county: m.county, state: m.state, enrollment: m.enrollment, oldest: m.oldestBuildingYear, gesa: m.lastEnergyProjectYear, esco: m.lastEnergyProjectEsco, debt: m.debtOutstanding, tier: m.tier },
    { name: 0, orgType: 1, county: 2, state: 3, enrollment: 4, oldest: 5, gesa: 6, esco: 7, debt: 8, tier: 9 },
    "guesses every column",
  );

  const p = buildPreview({
    headers: g.headers, rows: g.rows, headerRow: 3, mapping: m,
    defaults: { companyCodes: ["QES"], onDuplicate: "fill", inferType: true },
    allowedTypes: TYPES, companyCodes: ["QCG", "QES", "PCS", "JVS", "PYR", "ENT"], currentYear: 2026,
    existing: [{ id: "x1", name: "Existing Example SD", state: "PA", orgType: "school district", county: "Lancaster", companyCodes: [], enrollment: 5000, oldestBuildingYear: null }],
  });
  eq(p.rows.map((r) => r.action), ["create", "create", "create", "skip", "create", "error", "update"], "actions per row");
  eq(p.counts, { create: 4, update: 1, skip: 1, error: 1 }, "counts");
  const twp = p.rows[1].draft;
  eq([twp.orgType, twp.state, twp.county, twp.tier, twp.lastEnergyProjectYear, twp.debtOutstanding, twp.oldestBuildingYear], ["township", "PA", "Cumberland", "B", 2011, 1200000, 1972], "normalizes township row");
  eq([p.rows[2].draft.orgType, p.rows[2].notes[0]], ["borough", "Type taken from name: borough"], "infers type from name");
  eq(p.rows[0].draft.companyCodes, ["QES"], "default company tag applied");
  eq(p.rows[4].draft.orgType, "municipal authority", "water authority → municipal authority");
  eq(p.rows[4].notes.some((n) => n.startsWith('Tier "Z"')), true, "bad tier noted, not fatal");
  eq(p.rows[3].reason, "Same name, state, type and county as row 4", "in-file duplicate skipped (type synonyms match)");
  eq(p.rows[6].changes, ["Tier", "Oldest building (year built)", "Last energy project (year)", "Company tags +QES"], "fill mode fills blanks, keeps enrollment");
  eq(p.rows[6].line, 10, "spreadsheet line numbers");

  const skip = buildPreview({ headers: g.headers, rows: g.rows, headerRow: 3, mapping: m, defaults: { onDuplicate: "skip" }, allowedTypes: TYPES, companyCodes: [], currentYear: 2026,
    existing: [{ id: "x1", name: "existing example sd", state: "PA", orgType: "school district", county: "Lancaster", companyCodes: [] }] });
  eq(skip.rows[6].action, "skip", "skip mode + case-insensitive name match");

  eq([parseMoney("$1.5M"), parseMoney("250k"), parseMoney("12,000"), parseMoney("n/a"), parseMoney("abc")], [1500000, 250000, 12000, null, "bad"], "money parsing");
  eq(resolveOrgType("", "Example Area Career and Technical Center", TYPES, true).value, "career-tech center", "CTC from name");
  eq(resolveOrgType("", "Example County Housing Authority", TYPES, true).value, "housing authority", "housing authority beats county");
  eq(resolveOrgType("", "Town of Example", TYPES, true).value, "town", "town");
  eq(resolveOrgType("", "Example Township", TYPES, false).value, null, "no inference when turned off");

  const csv = Buffer.from("﻿Name,Type,State\n\"Example City, The\",City,NY\n,,\n");
  const cg = await readGrid("list.csv", csv, null, 1);
  eq([cg.headers, cg.rows], [["Name", "Type", "State"], [["Example City, The", "City", "NY"]]], "CSV with BOM, quotes, blank rows");

  // Similar names, county decides; junk prefixes; vague types; Y/N flags; notes; ESCO from text.
  const H = ["County", "Organization", "Type", "ARC county", "Tier", "Notes", "Recent energy or GESA project"];
  const R = [
    ["Schuylkill", "Schuylkill Intermediate Unit 29", "Intermediate unit", "Y", "A", "Call business manager", ""],
    ["Dauphin", "Capital Area Intermediate Unit 15", "Intermediate unit", "N", "B", "", ""],
    ["Berks", "|  [[Earl Township", "Township", "N", "", "", ""],
    ["Berks", "Reading Area Community College", "College", "N", "A", "", "GESA contract with SitelogIQ (2026)"],
    ["Tier A = active markets. Edit freely.", "", "", "", "", "", ""],
  ];
  const ex = [
    { id: "iu29", name: "Schuylkill IU 29", state: "PA", orgType: "intermediate unit / BOCES", county: "Schuylkill", companyCodes: [], arcCounty: true, tier: null },
    { id: "iu15", name: "Capital Area IU 15", state: "PA", orgType: "intermediate unit / BOCES", county: "Cumberland", companyCodes: [] },
  ];
  const TYPES2 = [...TYPES, "private college"];
  const mm = guessMapping(H);
  eq([mm.name, mm.county, mm.arcCounty, mm.tier, mm.lastEnergyProjectYear, mm.lastEnergyProjectEsco, mm.notes], [1, 0, 3, 4, 6, 6, [5, 6]], "maps targets-style headers (notes + energy text)");
  const q = buildPreview({ headers: H, rows: R, headerRow: 1, mapping: mm, defaults: { state: "PA", companyCodes: ["QES"] }, allowedTypes: TYPES2, companyCodes: ["QES"], existing: ex, currentYear: 2026 });
  eq([q.rows[0].action, q.rows[0].matchId, q.rows[0].matchedBy], ["update", "iu29", "similar"], "IU 29: similar name, same county → update");
  eq(q.rows[0].changes, ["Tier", "Company tags +QES", "Notes (appended)"], "ARC already Y; tier, tag, notes added");
  eq([q.rows[1].action, q.rows[1].possible?.id], ["create", "iu15"], "IU 15: similar name, other county → flagged");
  eq([q.rows[2].draft.name, q.rows[2].notes[0]], ["Earl Township", 'Name cleaned from "|  [[Earl Township"'], "junk prefix cleaned");
  eq([q.rows[3].draft.orgType, q.rows[3].draft.lastEnergyProjectEsco, q.rows[3].draft.lastEnergyProjectYear], ["community college", "SitelogIQ", 2026], "vague 'College' → name; ESCO + year from text");
  eq(q.rows[3].draft.notes, "Recent energy or GESA project: GESA contract with SitelogIQ (2026)", "energy text kept in notes");
  eq([q.rows[4].action, q.rows[4].reason], ["skip", "Note or blank row"], "footnote row skipped quietly");
  const q2 = buildPreview({ headers: H, rows: R.slice(1, 2), headerRow: 1, mapping: mm, defaults: { state: "PA", resolutions: { "2": "iu15" } }, allowedTypes: TYPES2, companyCodes: [], existing: ex, currentYear: 2026 });
  eq([q2.rows[0].action, q2.rows[0].matchedBy], ["update", "person"], "a person's decision ties IU 15 to the existing record");

  if (fail) process.exit(1);
})();
