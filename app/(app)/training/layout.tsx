import { NavLinks } from "@/components/NavLinks";
import { prisma } from "@/lib/db";
import { canFacilitate } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export default async function TrainingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const links: [string, string][] = [["/training", "My learning"], ["/training/library", "Reference library"], ["/training/ninety", "First 90 days"]];
  if (canFacilitate(user.role)) {
    const waiting = await prisma.deliverableSubmission.count({ where: { status: "SUBMITTED" } });
    links.push(["/training/review", `Review${waiting ? ` · ${waiting}` : ""}`], ["/training/gradebook", "Gradebook"], ["/training/assign", "Assign"], ["/training/capstone", "Capstone"]);
  }
  return (
    <>
      <div className="mb-4 border-b" style={{ borderColor: "var(--line)" }}>
        <div className="eyebrow">Training · Projects, Partners, Programs</div>
        <TrainingNav links={links} />
      </div>
      {children}
    </>
  );
}

function TrainingNav({ links }: { links: [string, string][] }) {
  return <NavLinks links={links} exact="/training" />;
}
