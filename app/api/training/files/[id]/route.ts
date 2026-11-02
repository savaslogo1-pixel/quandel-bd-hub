import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canFacilitate } from "@/lib/permissions";

/** Download a deliverable file: the person who submitted it, or a facilitator. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() } });
  const sub = await prisma.deliverableSubmission.findUnique({ where: { id }, select: { userId: true, fileName: true, fileType: true, fileData: true } });
  if (!me || !sub?.fileData) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (sub.userId !== me.id && !canFacilitate(me.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  return new NextResponse(new Uint8Array(sub.fileData), {
    headers: {
      "Content-Type": sub.fileType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${(sub.fileName ?? "deliverable").replace(/[^\w.\- ]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
