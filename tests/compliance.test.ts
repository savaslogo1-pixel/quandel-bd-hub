import { giftOverLimit, lobbyingStatus } from "../lib/compliance";
import { complianceFlags, type GateOpp } from "../lib/pipeline";

let fail = 0;
const eq = (a: unknown, b: unknown, m: string) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) { fail++; console.log("FAIL", m, JSON.stringify(a), "≠", JSON.stringify(b)); } else console.log("ok  ", m);
};
eq([lobbyingStatus(1000, 5000).state, lobbyingStatus(4000, 5000).state, lobbyingStatus(5000, 5000).state, lobbyingStatus(6200, 5000).state, lobbyingStatus(99, null).state], ["ok", "near", "over", "over", "unknown"], "lobbying: ok / 80% near / at-or-over / no threshold");
eq([giftOverLimit(75, 75), giftOverLimit(75.01, 75), giftOverLimit(500, null)], [false, true, null], "NY $75: equal is fine, over flags, no rule → unknown");

const base: GateOpp = { stage: 7, deliveryMethod: "SINGLE_PRIME_BID", goNoGo: "GO", outcome: null, lossReason: null, helpedWriteSpecs: false, procIndependenceAt: null, disclosureDecision: null, aeNoConflictCertAt: null, companyCodes: ["QCG"], org: { state: "PA", orgType: "county" }, tradeSecretsMarked: false, restrictedPeriod: false };
eq(complianceFlags(base).map((f) => f.text), ["Trade secrets not marked on the submission"], "submitted without trade secrets marked");
eq(complianceFlags({ ...base, tradeSecretsMarked: true }).length, 0, "marked → clear");
eq(complianceFlags({ ...base, stage: 6, org: { state: "NY", orgType: "state agency" } }).map((f) => f.text), ["NY state procurement: record the restricted period and designated contacts"], "NY state agency in pursuit → restricted period");
eq(complianceFlags({ ...base, stage: 6, org: { state: "NY", orgType: "state agency" }, restrictedPeriod: true }).length, 0, "restricted period recorded → clear");
if (fail) process.exit(1);

// Exports: spreadsheet formula injection is neutralized; CSV quoting is correct.
import("../lib/export").then(({ safeCell, toCsv }) => {
  const e2 = (a: unknown, b: unknown, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) { console.log("FAIL", m, JSON.stringify(a), "≠", JSON.stringify(b)); process.exit(1); } else console.log("ok  ", m); };
  e2([safeCell("=HYPERLINK(\"x\")"), safeCell("+1"), safeCell("-2"), safeCell("@SUM(A1)"), safeCell("Allentown"), safeCell(-5), safeCell(null)], ["'=HYPERLINK(\"x\")", "'+1", "'-2", "'@SUM(A1)", "Allentown", -5, null], "formula-looking text is prefixed; numbers untouched");
  e2(toCsv([{ Name: 'Town of "Example", NY', Value: 5 }, { Name: "=cmd", Value: null }]), '﻿Name,Value\r\n"Town of ""Example"", NY",5\r\n\'=cmd,', "CSV quotes commas and quotes; BOM for Excel");
});
