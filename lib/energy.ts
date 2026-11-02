// QES energy savings contract math and state checks (SPEC §4.10). Pure; see tests/energy.test.ts.

export type MeasureIn = { name: string; cost: number | null; annualSavings: number | null; electivePayAmount: number | null };
export type Framework = "PA_GESA" | "NY_EPC" | "HUD_EPC" | null;
export type RuleValues = {
  paCostTestYears: number | null; paNonEnergyCapPct: number | null; paPublicNoticeDays: number | null;
  nyMaxTermYears: number | null; nySchoolPaybackYears: number | null; hudMaxTermYears: number | null;
};
export type Check = { key: string; label: string; state: "pass" | "fail" | "unknown" | "info"; detail: string };

/** Level annual payment on `principal` at `ratePct` for `years` (end-of-year payments). */
export function annualPayment(principal: number, ratePct: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;
  const r = ratePct / 100;
  if (r === 0) return principal / years;
  return (principal * r) / (1 - Math.pow(1 + r, -years));
}

export const simplePayback = (cost: number | null, annualSavings: number | null) =>
  cost != null && annualSavings != null && annualSavings > 0 ? cost / annualSavings : null;

/** Which contract rules apply: housing authorities use HUD EPC; otherwise the owner's state. */
export function frameworkFor(state: string, orgType: string): Framework {
  if (orgType === "housing authority") return "HUD_EPC";
  if (state === "PA") return "PA_GESA";
  if (state === "NY") return "NY_EPC";
  return null;
}

const $ = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export function energyModel(input: {
  measures: MeasureIn[];
  nonEnergyCost: number | null;
  otherFunding: number | null;
  ratePct: number | null;
  termYears: number | null;
  guaranteedOverride: number | null;
  framework: Framework;
  isSchool: boolean;
  rules: RuleValues;
}) {
  const energyCost = input.measures.reduce((a, m) => a + (m.cost ?? 0), 0);
  const nonEnergy = input.nonEnergyCost ?? 0;
  const projectCost = energyCost + nonEnergy;
  const electivePay = input.measures.reduce((a, m) => a + (m.electivePayAmount ?? 0), 0);
  const financed = Math.max(0, projectCost - electivePay - (input.otherFunding ?? 0));
  const measureSavings = input.measures.reduce((a, m) => a + (m.annualSavings ?? 0), 0);
  const guaranteed = input.guaranteedOverride ?? measureSavings;
  const term = input.termYears;
  const rate = input.ratePct ?? 0;
  const payment = term ? annualPayment(financed, rate, term) : null;
  const payback = simplePayback(projectCost, guaranteed);
  const checks: Check[] = [];

  if (payment == null) checks.push({ key: "budget", label: "Budget-neutral", state: "unknown", detail: "Enter the term (and financing rate) to compute the annual payment." });
  else if (!guaranteed) checks.push({ key: "budget", label: "Budget-neutral", state: "unknown", detail: "Enter guaranteed annual savings on the measures." });
  else checks.push({
    key: "budget", label: "Budget-neutral", state: payment <= guaranteed ? "pass" : "fail",
    detail: `Annual payment ${$(payment)} vs guaranteed savings ${$(guaranteed)}: ${payment <= guaranteed ? "margin" : "shortfall"} ${$(Math.abs(guaranteed - payment))} a year.`,
  });

  const termCheck = (max: number | null, key: string, rule: string) => {
    if (max == null) checks.push({ key, label: "Term", state: "unknown", detail: `${rule} has no value yet in State rules. [confirm]` });
    else if (term == null) checks.push({ key, label: "Term", state: "unknown", detail: `Limit is ${max} years; enter the term.` });
    else checks.push({ key, label: "Term", state: term <= max ? "pass" : "fail", detail: `${term} years vs ${max}-year limit (${rule}).` });
  };

  if (input.framework === "PA_GESA") {
    termCheck(input.rules.paCostTestYears, "term", "PA.gesa_cost_test_years");
    if (payment != null && guaranteed && term) {
      const years = Math.min(term, input.rules.paCostTestYears ?? term);
      const ok = guaranteed * years >= payment * term;
      checks.push({ key: "costtest", label: "Cost test", state: ok ? "pass" : "fail", detail: `Savings over ${years} years ${$(guaranteed * years)} vs total payments ${$(payment * term)}.` });
    }
    const cap = input.rules.paNonEnergyCapPct;
    if (cap == null) checks.push({ key: "nonenergy", label: "Non-energy share", state: "unknown", detail: "PA.gesa_non_energy_cap_pct has no value yet. [confirm]" });
    else if (projectCost > 0) {
      const pct = (nonEnergy / projectCost) * 100;
      checks.push({ key: "nonenergy", label: "Non-energy share", state: pct <= cap ? "pass" : "fail", detail: `${pct.toFixed(1)}% of the contract vs the ${cap}% cap (§ 3754(d)).` });
    }
    checks.push({ key: "notice", label: "Public notice", state: "info", detail: `Advertise ${input.rules.paPublicNoticeDays ?? "[confirm]"} days before the board awards the contract.` });
  } else if (input.framework === "NY_EPC") {
    termCheck(input.rules.nyMaxTermYears, "term", "NY.epc_max_term_years");
    if (input.isSchool) {
      const max = input.rules.nySchoolPaybackYears;
      if (max == null || payback == null) checks.push({ key: "payback", label: "School payback", state: "unknown", detail: max == null ? "NY.school_epc_payback_years has no value yet. [confirm]" : "Enter costs and savings." });
      else checks.push({ key: "payback", label: "School payback", state: payback <= max ? "pass" : "fail", detail: `Simple payback ${payback.toFixed(1)} years vs ${max} years without building aid.` });
      checks.push({ key: "sed", label: "SED approval", state: "info", detail: "Schools need State Education Department approval." });
    }
    if (nonEnergy > 0) checks.push({ key: "nonenergy", label: "Non-energy work", state: "info", detail: "NY sets no non-energy allowance; confirm how the non-energy scope is procured." });
  } else if (input.framework === "HUD_EPC") {
    termCheck(input.rules.hudMaxTermYears, "term", "HUD.epc_max_term_years");
    checks.push({ key: "hud", label: "HUD approvals", state: "info", detail: "HUD approves the RFP and the contract (PIH 2024-27); plan for HUD review time." });
  } else {
    checks.push({ key: "framework", label: "State rules", state: "info", detail: "No energy-contract rules are loaded for this state yet." });
  }

  return { energyCost, nonEnergy, projectCost, electivePay, financed, guaranteed, measureSavings, payment, payback, termSavings: term ? guaranteed * term : null, termPayments: payment != null && term ? payment * term : null, checks };
}
