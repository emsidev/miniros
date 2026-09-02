import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { claimMembershipInvitations } from "@/server/services/invitations";
import { ensureProfile } from "@/server/services/profiles";

function getSafeNextPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/businesses";
}

function getCallbackErrorPath(nextPath: string) {
  return nextPath === "/reset-password/update"
    ? "/reset-password?error=expired"
    : "/login?error=oauth_callback_failed";
}

function redirectToRequestOrigin(request: Request, path: string) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const host = forwardedHost?.split(",", 1)[0]?.trim();

  if (process.env.NODE_ENV !== "development" && host) {
    const protocol = forwardedProtocol?.split(",", 1)[0]?.trim() || "https";
    return NextResponse.redirect(`${protocol}://${host}${path}`);
  }

  return NextResponse.redirect(`${requestUrl.origin}${path}`);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return redirectToRequestOrigin(request, getCallbackErrorPath(nextPath));
  }

  const supabase = await createClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return redirectToRequestOrigin(request, getCallbackErrorPath(nextPath));
  }

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) {
    return redirectToRequestOrigin(request, getCallbackErrorPath(nextPath));
  }

  await Promise.all([
    ensureProfile(
      data.user.id,
      typeof data.user.user_metadata.full_name === "string"
        ? data.user.user_metadata.full_name
        : null,
    ),
    claimMembershipInvitations(data.user),
  ]);

  return redirectToRequestOrigin(request, nextPath);
}
