import Image from "next/image";
import { devLoginEnabled } from "@/lib/auth";
import { SignInForms } from "./SignInForms";

export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  AccessDenied: "This account can't sign in. It may be outside the allowed email domain, or deactivated by an admin.",
  CredentialsSignin: "Enter a valid email address.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="wrap flex min-h-screen items-center justify-center py-10">
      <div className="panel w-full max-w-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="rounded-md bg-white px-2 py-1 shadow-[0_0_0_1px_var(--line)]">
            <Image src="/quandel-logo.png" alt="Quandel Enterprises" width={110} height={41} style={{ height: 30, width: "auto" }} />
          </span>
          <div>
            <h1 className="text-[22px] uppercase tracking-wider">BD Hub</h1>
            <div className="eyebrow">Projects · Partners · Programs</div>
          </div>
        </div>
        {error && <p className="banner banner-bad">{ERRORS[error] ?? "Sign-in failed. Try again."}</p>}
        <SignInForms microsoft={!!process.env.AZURE_AD_CLIENT_ID} dev={devLoginEnabled} />
      </div>
    </main>
  );
}
