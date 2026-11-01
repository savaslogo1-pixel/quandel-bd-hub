"use client";

import { signOut } from "next-auth/react";

export function SignOut() {
  return <button className="btn btn-sm" onClick={() => signOut({ callbackUrl: "/signin" })}>Sign out</button>;
}
