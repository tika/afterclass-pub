import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

const isProtectedRoute = (pathname: string) =>
  ["/clubs", "/dashboard", "/admin"].some((r) => pathname.startsWith(r));

const PRODUCTION_DOMAINS = ["afterclass.rsvp", "app.afterclass.rsvp", "admin.afterclass.rsvp"];
const PUBLIC_PATHS = ["/"];

function normalizeHost(host: string): string {
  return host.split(":")[0] ?? host;
}

function isProductionHost(host: string): boolean {
  return PRODUCTION_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

async function handleAuth(request: NextRequest): Promise<NextResponse | undefined> {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  if (!sessionCookie && isProtectedRoute(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (sessionCookie && ["/login", "/signup"].includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return undefined;
}

export async function proxy(request: NextRequest, _event: NextFetchEvent) {
  const authResponse = await handleAuth(request);
  if (authResponse) return authResponse;

  const host = normalizeHost(request.headers.get("host") ?? "");

  if (!isProductionHost(host)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  switch (host) {
    case "admin.afterclass.rsvp": {
      if (
        !pathname.startsWith("/admin") &&
        !pathname.startsWith("/_next") &&
        !pathname.startsWith("/api")
      ) {
        const dest = request.nextUrl.clone();
        dest.pathname = `/admin${pathname}`;
        return NextResponse.rewrite(dest);
      }
      break;
    }

    case "app.afterclass.rsvp": {
      if (pathname === "/" || pathname === "") {
        const dest = new URL(request.url);
        dest.pathname = "/dashboard";
        return NextResponse.redirect(dest, 308);
      }
      if (pathname.startsWith("/admin")) {
        const dest = new URL(request.url);
        dest.hostname = "admin.afterclass.rsvp";
        dest.port = "";
        return NextResponse.redirect(dest, 308);
      }
      break;
    }

    case "afterclass.rsvp":
    case "www.afterclass.rsvp": {
      if (!PUBLIC_PATHS.includes(pathname)) {
        const dest = new URL(request.url);
        dest.hostname = "app.afterclass.rsvp";
        dest.port = "";
        return NextResponse.redirect(dest, 308);
      }
      break;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/(dashboard|admin|clubs)(.*)",
  ],
};
