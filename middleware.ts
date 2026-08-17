import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Keep in sync with `config.matcher` below — the matcher decides which requests
// reach this middleware at all, so a route missing from either list is
// effectively unprotected at the edge.
//
// `/settings` and `/shopping-list` also do their own session check in their
// server components. That check is the real backstop; redirecting here just
// avoids rendering work for a request we already know is unauthenticated.
const PROTECTED_ROUTES = [
  "/cookbook",
  "/settings",
  "/shopping-list",
  "/api/extraction",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    // `getSessionCookie` reads the raw cookie header rather than trusting a
    // fixed name: Better-Auth prefixes the cookie with `__Secure-` whenever the
    // request is served over HTTPS, so a literal `better-auth.session_token`
    // lookup works locally and silently redirect-loops every signed-in user in
    // production. This is presence-only (no signature/DB check), same as
    // before — the real auth boundary stays in the server components.
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      const signInUrl = new URL("/auth/signin", request.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/cookbook/:path*",
    "/settings/:path*",
    "/shopping-list/:path*",
    "/api/extraction/:path*",
  ],
};
