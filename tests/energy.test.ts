import { annualPayment, energyModel, frameworkFor } from "../lib/energy";
import { bundleEstimate } from "../lib/bridges";

let fail = 0;
const eq = (a: unknown, b: unknown, m: string) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) { fail++; console.log("FAIL", m, JSON.stringify(a), "≠", JSON.stringify(b)); } else console.log("ok  ", m);
};
const near = (a: number | null, b: number, m: string, tol = 1) => eq(a != null && Math.abs(a - b) <= tol, true, `${m} (${a?.toFixed(2)} ≈ ${b})`);
const RULES = { paCostTestYears: 20, paNonEnergyCapPct: 15, paPublicNoticeDays: 10, nyMaxTermYears: 35, nySchoolPaybackYears: 18, hudMaxTermYears: 20 };

// Amortization: $1,000,000 at 4% for 15 years → $89,941.10 per year (standard annuity formula).
near(annualPayment(1_000_000, 4, 15), 89941.1, "annuity payment", 0.5);
near(annualPayment(1_200_000, 0, 20), 60000, "zero rate = straight line", 0.01);
eq([frameworkFor("PA", "school district"), frameworkFor("NY", "town"), frameworkFor("PA", "housing authority"), frameworkFor("MD", "county")], ["PA_GESA", "NY_EPC", "HUD_EPC", null], "framework by state / housing authority");

// PA GESA: $2.5M of measures + $400K roof, $100K elective pay, $200K grant, 4% for 20 years.
const pa = energyModel({
  measures: [
    { name: "LED", cost: 500_000, annualSavings: 60_000, electivePayAmount: null },
    { name: "HVAC", cost: 1_500_000, annualSavings: 110_000, electivePayAmount: null },
    { name: "Solar", cost: 500_000, annualSavings: 45_000, electivePayAmount: 100_000 },
  ],
  nonEnergyCost: 400_000, otherFunding: 200_000, ratePct: 4, termYears: 20, guaranteedOverride: null, framework: "PA_GESA", isSchool: true, rules: RULES,
});
eq([pa.projectCost, pa.electivePay, pa.financed, pa.guaranteed], [2_900_000, 100_000, 2_600_000, 215_000], "PA totals: cost, elective pay, financed, guaranteed");
near(pa.payment, 191_313.5, "PA annual payment on $2.6M at 4% / 20 yrs", 1);
eq(pa.checks.find((c) => c.key === "budget")?.state, "pass", "budget-neutral: $191K payment ≤ $215K savings");
eq(pa.checks.find((c) => c.key === "term")?.state, "pass", "20 years within the 20-year cost test");
eq(pa.checks.find((c) => c.key === "nonenergy")?.state, "pass", "non-energy 13.8% ≤ 15% cap");
eq(pa.checks.find((c) => c.key === "nonenergy")?.detail.startsWith("13.8%"), true, "non-energy share shown");

const paBad = energyModel({ measures: [{ name: "HVAC", cost: 2_000_000, annualSavings: 100_000, electivePayAmount: null }], nonEnergyCost: 500_000, otherFunding: null, ratePct: 4, termYears: 25, guaranteedOverride: null, framework: "PA_GESA", isSchool: false, rules: RULES });
eq(["budget", "term", "costtest", "nonenergy"].map((k) => paBad.checks.find((c) => c.key === k)?.state), ["fail", "fail", "fail", "fail"], "PA fails: shortfall, 25 > 20 years, cost test, 20% non-energy");

const ny = energyModel({ measures: [{ name: "Boilers", cost: 1_900_000, annualSavings: 100_000, electivePayAmount: null }], nonEnergyCost: null, otherFunding: null, ratePct: 3.5, termYears: 18, guaranteedOverride: null, framework: "NY_EPC", isSchool: true, rules: RULES });
eq([ny.checks.find((c) => c.key === "term")?.state, ny.checks.find((c) => c.key === "payback")?.state], ["pass", "fail"], "NY school: term ok, 19-year payback > 18");
const hud = energyModel({ measures: [{ name: "Water", cost: 800_000, annualSavings: 70_000, electivePayAmount: null }], nonEnergyCost: null, otherFunding: null, ratePct: 5, termYears: 20, guaranteedOverride: 75_000, framework: "HUD_EPC", isSchool: false, rules: { ...RULES, hudMaxTermYears: null } });
eq([hud.guaranteed, hud.checks.find((c) => c.key === "term")?.state], [75_000, "unknown"], "override savings; missing rule → unknown, not pass");
eq(energyModel({ measures: [], nonEnergyCost: null, otherFunding: null, ratePct: null, termYears: null, guaranteedOverride: null, framework: "PA_GESA", isSchool: false, rules: RULES }).checks[0].state, "unknown", "no inputs → unknown");

// Bundle estimate
const e = bundleEstimate(
  [
    { id: "a", name: "A", county: "Schuylkill", bridgeType: "Box beam", estimate: 900_000, lengthFt: null, widthFt: null },
    { id: "b", name: "B", county: "Schuylkill", bridgeType: "Box beam", estimate: null, lengthFt: 40, widthFt: 30 },
    { id: "c", name: "C", county: "Berks", bridgeType: null, estimate: null, lengthFt: null, widthFt: null },
  ],
  { unitCostPerSqFt: 500, designPct: 8, cmPct: 4, contingencyPct: 10 },
);
eq([e.construction, e.missing, e.complete], [1_500_000, 1, false], "own estimate + area × unit cost; one missing");
eq([e.design, e.cm, e.contingency, e.total], [120_000, 60_000, 150_000, 1_830_000], "soft costs and contingency on construction");
eq(e.groups.map((g) => [g.type, g.county, g.count, g.cost]), [["Box beam", "Schuylkill", 2, 1_500_000], ["Type not set", "Berks", 1, 0]], "grouped by type and county");
eq(bundleEstimate([{ id: "a", name: "A", county: "X", bridgeType: null, estimate: 100, lengthFt: null, widthFt: null }], { unitCostPerSqFt: null, designPct: null, cmPct: null, contingencyPct: null }).complete, true, "complete when every bridge has a basis");

if (fail) process.exit(1);
