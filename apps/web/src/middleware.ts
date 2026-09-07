import { NextResponse, type NextRequest } from "next/server";
import { developmentSkeletonEnabled } from "@/lib/development-skeleton";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/dev/workflow-skeleton") {
    return developmentSkeletonEnabled(
      process.env.NODE_ENV,
      process.env.MINIROS_V2_SKELETON,
    )
      ? NextResponse.next()
      : new NextResponse(null, { status: 404 });
  }
  if (
    [
      "/offline",
      "/install",
      "/sync",
      "/help",
      "/sw.js",
      "/pwa-assets.json",
      "/manifest.webmanifest",
    ].includes(request.nextUrl.pathname)
  ) {
    return (await import("next/server")).NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
