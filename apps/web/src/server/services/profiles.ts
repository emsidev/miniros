import { requireDatabase } from "@miniros/db";
import { profiles } from "@miniros/db/schema";

export async function ensureProfile(userId: string, fullName?: string | null) {
  const database = requireDatabase();

  const [profile] = await database
    .insert(profiles)
    .values({
      id: userId,
      fullName: fullName?.trim() || null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        ...(fullName?.trim() ? { fullName: fullName.trim() } : {}),
        updatedAt: new Date(),
      },
    })
    .returning();

  return profile;
}
