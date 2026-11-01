import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./db";

export const devLoginEnabled =
  process.env.DEV_LOGIN === "true" && process.env.NODE_ENV !== "production";

const providers: NextAuthOptions["providers"] = [];

if (process.env.AZURE_AD_CLIENT_ID) {
  providers.push(
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET ?? "",
      tenantId: process.env.AZURE_AD_TENANT_ID,
    }),
  );
}

if (devLoginEnabled) {
  providers.push(
    CredentialsProvider({
      id: "dev",
      name: "Development sign-in",
      credentials: { email: { label: "Email", type: "email" } },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        if (!email || !email.includes("@")) return null;
        return { id: email, email, name: email.split("@")[0] };
      },
    }),
  );
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers,
  pages: { signIn: "/signin" },
  callbacks: {
    // Creates the user on first sign-in. The very first user becomes ADMIN;
    // everyone after starts as TRAINEE until an admin sets their role.
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      const domain = process.env.ALLOWED_EMAIL_DOMAIN?.toLowerCase();
      if (domain && !email.endsWith("@" + domain)) return false;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        if (!existing.active) return false;
        if (user.name && !existing.name)
          await prisma.user.update({ where: { email }, data: { name: user.name } });
        return true;
      }
      const isFirst = (await prisma.user.count()) === 0;
      await prisma.user.create({
        data: { email, name: user.name ?? null, role: isFirst ? "ADMIN" : "TRAINEE" },
      });
      return true;
    },
    async jwt({ token }) {
      if (token.email) {
        const u = await prisma.user.findUnique({ where: { email: token.email.toLowerCase() } });
        if (u) {
          token.uid = u.id;
          token.role = u.role;
          token.name = u.name ?? token.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid ?? "";
        session.user.role = token.role ?? "TRAINEE";
      }
      return session;
    },
  },
};
