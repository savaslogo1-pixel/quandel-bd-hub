import { buildBridgePreview, guessBridgeMapping } from "../lib/import/bridges";

let fail = 0;
const eq = (a: unknown, b: unknown, m: string) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) { fail++; console.log("FAIL", m, JSON.stringify(a), "≠", JSON.stringify(b)); } else console.log("ok  ", m);
};
const H = ["County", "Bridge (as published)", "Year built", "Age (years)", "Vehicles/day", "Route type (from name)", "Likely owner (from name)", "Verified owner", "Municipality", "Bundle candidate (Y/N)", "Contact", "Status", "Notes"];
const R = [
  ["Schuylkill", "SR 4013 over Rattling Creek", "1937", "88", "372", "State route", "PennDOT", "", "", "", "", "", ""],
  ["Schuylkill", "SR 4013 over Rattling Creek", "1974", "51", "372", "State route", "PennDOT", "", "", "", "", "", ""],
  ["Luzerne", "TR309 Cross Valley over Toby Creek", "1963", "62", "41421", "Verify", "Verify (name omits route number)", "", "", "", "", "", ""],
  ["Luzerne", "TR309 Cross Valley over Toby Creek", "1963", "62", "41421", "Verify", "Verify (name omits route number)", "", "", "", "", "", ""],
  ["Berks", "Mill Road over Maiden Creek", "1925", "100", "450", "Local road", "Township (name suggests)", "Example Township", "Example Township", "Y", "Roadmaster", "", "Narrow"],
  ["Tier note only", "", "", "", "", "", "", "", "", "", "", "", ""],
];
const m = guessBridgeMapping(H);
eq([m.county, m.name, m.yearBuilt, m.adt, m.routeType, m.likelyOwner, m.verifiedOwner, m.bundleCandidate], [0, 1, 2, 4, 5, 6, 7, 9], "maps Bridge List headers");
const p = buildBridgePreview({ rows: R, headerRow: 1, mapping: m, defaults: { condition: "Poor" }, existing: [] });
eq(p.counts, { create: 5, update: 0, skip: 1, error: 0 }, "same-named bridges and twin spans are all kept; note row skipped");
eq(new Set(p.rows.filter((r) => r.key).map((r) => r.key)).size, 5, "every bridge gets a distinct key");
eq([p.rows[2].draft?.ownerName, p.rows[2].draft?.routeType], [null, null], "'Verify' placeholders aren't stored as owner or route");
eq([p.rows[4].draft?.ownerName, p.rows[4].draft?.ownerVerified, p.rows[4].draft?.bundleCandidate, p.rows[4].draft?.notes], ["Example Township", true, true, "Narrow\nContact: Roadmaster"], "verified owner wins; Y/N; contact kept in notes");
eq(p.rows[0].draft?.condition, "Poor", "condition from the file's default");
const again = buildBridgePreview({ rows: R, headerRow: 1, mapping: m, defaults: {}, existing: p.rows.filter((r) => r.key).map((r, i) => ({ id: `b${i}`, importKey: r.key! })) });
eq(again.counts, { create: 0, update: 5, skip: 1, error: 0 }, "re-importing the same file updates instead of duplicating");
const withId = buildBridgePreview({ rows: [["Schuylkill", "A over B", "1950", "", "10", "", "", "", "", "", "", "", "", "123456"]], headerRow: 1, mapping: { ...m, structureId: 13 }, defaults: {}, existing: [] });
eq(withId.rows[0].key, "nbi:123456", "NBI structure number is the key when present");

if (fail) process.exit(1);
