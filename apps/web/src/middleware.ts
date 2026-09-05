import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
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
