// Cross-sell routing (SPEC §2). Suggests companies; a person makes the final decision.

const BUILDING = ["new building", "renovation", "addition", "housing"];

export type RoutingInput = {
  projectType: string | null;
  deliveryMethod: string | null;
  nonEnergyScope: boolean;
  org: { state: string; orgType: string };
};

export function suggestCompanies(i: RoutingInput): { codes: string[]; reasons: string[] } {
  const codes: string[] = [];
  const reasons: string[] = [];
  const add = (c: string, why: string) => {
    if (!codes.includes(c)) codes.push(c);
    reasons.push(why);
  };
  const pt = i.projectType ?? "";
  const st = i.org.state;
  if (pt === "bridge" || pt === "water/wastewater") {
    add("PCS", "Bridge, water or wastewater → PCS");
    if (i.deliveryMethod === "P3_BUNDLE") add("QCG", "P3 bundle → with QCG");
  }
  if (pt === "energy") {
    add("QES", "Energy → QES");
    if (i.nonEnergyScope) add("QCG", "Energy work that also needs roof, ADA or other non-energy work → QES + QCG (disclosure step)");
  }
  // "Building in MD, DC or VA; or K-12 or healthcare CM south of PA". Only MD, DC and VA are
  // treated as "south of PA" until BD confirms whether DE and WV count. [confirm]
  if (BUILDING.includes(pt) && ["MD", "DC", "VA"].includes(st)) add("JVS", "Building in MD, DC or VA → JVS");
  if (BUILDING.includes(pt) && ["PA", "NY"].includes(st)) add("QCG", "Building, renovation or addition in PA or NY → QCG");
  return { codes, reasons };
}
