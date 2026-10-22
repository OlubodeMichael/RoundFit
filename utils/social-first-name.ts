/**
 * First-name extraction for Apple / Google sign-in.
 *
 * Apple only hands the name to the app (never in the identity token), and only
 * on the very first authorisation. Google's name arrives in Supabase's
 * `user_metadata` (`full_name` / `name`, sometimes `given_name`).
 */

const METADATA_GIVEN_NAME_KEYS = ["given_name", "first_name"] as const;
const METADATA_FULL_NAME_KEYS = ["full_name", "name"] as const;

/** First whitespace-separated word of a full name, or null when blank. */
export function firstNameFromFullName(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? first : null;
}

function stringField(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** First name from a Supabase `user_metadata` object, or null. */
export function firstNameFromUserMetadata(
  meta: Record<string, unknown> | null | undefined,
): string | null {
  if (!meta) return null;
  for (const key of METADATA_GIVEN_NAME_KEYS) {
    const given = stringField(meta, key);
    if (given) return given;
  }
  for (const key of METADATA_FULL_NAME_KEYS) {
    const first = firstNameFromFullName(stringField(meta, key));
    if (first) return first;
  }
  return null;
}
