export { default } from "next-auth/middleware";

// Everything except sign-in, NextAuth routes and static files needs a session.
export const config = {
  matcher: ["/((?!signin|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
