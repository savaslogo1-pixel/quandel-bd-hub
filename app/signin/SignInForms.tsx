"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function SignInForms({ microsoft, dev }: { microsoft: boolean; dev: boolean }) {
  const [email, setEmail] = useState("");
  return (
    <div className="flex flex-col gap-4">
      {microsoft && (
        <button className="btn btn-primary justify-center" onClick={() => signIn("azure-ad", { callbackUrl: "/" })}>
          Sign in with Microsoft 365
        </button>
      )}
      {dev && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            signIn("dev", { email, callbackUrl: "/" });
          }}
        >
          <label className="field">
            <span>Development sign-in (local only, no password)</span>
            <input id="dev-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
          </label>
          <button type="submit" className="btn">Continue</button>
        </form>
      )}
      {!microsoft && !dev && (
        <p className="banner banner-warn">No sign-in method is configured. Set the AZURE_AD_* variables (see .env.example).</p>
      )}
    </div>
  );
}
