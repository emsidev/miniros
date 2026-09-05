"use server";
import { assertDeviceCanLeave } from "../services/offline-context";

import { actionFailure, actionSuccess } from "@miniros/contracts";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionError } from "./helpers";
import { ACTIVE_BUSINESS_COOKIE } from "../services/access";
import { claimMembershipInvitations } from "../services/invitations";
import { ensureProfile } from "../services/profiles";

const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

const registerSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(2).max(100),
});

export async function registerAction(input: unknown) {
  try {
    const values = registerSchema.parse(input);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { full_name: values.fullName } },
    });

    if (error || !data.user) {
      return actionFailure(error?.message ?? "Registration failed.");
    }

    if (data.session) {
      // With email confirmation enabled, signUp can also return an obfuscated
      // user for an existing account. Only persist an authenticated identity.
      const { data: verified, error: verificationError } =
        await supabase.auth.getUser();
      if (verificationError || !verified.user) {
        return actionFailure("Please sign in to finish registration.");
      }
      await Promise.all([
        ensureProfile(verified.user.id, values.fullName),
        claimMembershipInvitations(verified.user),
      ]);
    }
    return actionSuccess({
      userId: data.user.id,
      requiresEmailConfirmation: !data.session,
    });
  } catch (error) {
    return actionError(error);
  }
}

export async function loginAction(input: unknown) {
  try {
    const values = credentialsSchema.parse(input);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword(values);

    if (error || !data.user) {
      return actionFailure(error?.message ?? "Sign in failed.");
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
    return actionSuccess({ userId: data.user.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function logoutAction() {
  try {
    const { requireUser } = await import("../services/access");
    await assertDeviceCanLeave((await requireUser()).id);
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return actionFailure(error.message);
    }

    const cookieStore = await cookies();
    cookieStore.delete(ACTIVE_BUSINESS_COOKIE);
    return actionSuccess({ signedOut: true as const });
  } catch (error) {
    return actionError(error);
  }
}
