import { NextResponse, type NextRequest } from "next/server";
import { developmentSkeletonEnabled } from "@/lib/development-skeleton";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Public staff shell contains no account data. Identity-scoped IndexedDB boots it.
  if (
    [
      "/offline",
      "/sw.js",
      "/pwa-assets.json",
      "/manifest.webmanifest",
      "/install",
      "/sync",
    ].includes(request.nextUrl.pathname)
  ) {
    return NextResponse.next();
  }
  // Native routes verify Bearer identity with getUser; web cookie refresh is unrelated.
  if (request.nextUrl.pathname.startsWith("/api/native/v2/")) {
    return NextResponse.next();
  }
  if (
    ["/dev/workflow-skeleton", "/dev/staff-preview"].includes(
      request.nextUrl.pathname,
    )
  ) {
    return developmentSkeletonEnabled(
      process.env.NODE_ENV,
      process.env.MINIROS_V2_SKELETON,
    )
      ? NextResponse.next()
      : new NextResponse(null, { status: 404 });
  }
  if (request.nextUrl.pathname === "/help") {
    return (await import("next/server")).NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
