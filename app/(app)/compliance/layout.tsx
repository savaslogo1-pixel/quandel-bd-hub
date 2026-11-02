import { NavLinks } from "@/components/NavLinks";

export default function ComplianceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mb-4 border-b" style={{ borderColor: "var(--line)" }}>
        <div className="eyebrow">Compliance</div>
        <NavLinks exact="/compliance" links={[["/compliance", "Open flags"], ["/compliance/gifts", "Gifts and hospitality"], ["/compliance/lobbying", "Lobbying"], ["/compliance/financing", "Municipal advisor"], ["/compliance/attestations", "Attestations"]]} />
      </div>
      {children}
    </>
  );
}
