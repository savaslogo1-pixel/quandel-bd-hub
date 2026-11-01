import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { prisma } from "./db";

/** The signed-in user, fresh from the database (role changes apply immediately). */
export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/signin");
  const user = await prisma.user.findUnique({
    where: { email: session.user.email.toLowerCase() },
    include: { companies: true },
  });
  if (!user || !user.active) redirect("/signin?error=AccessDenied");
  return user;
}

export type CurrentUser = Awaited<ReturnType<typeof requireUser>>;
