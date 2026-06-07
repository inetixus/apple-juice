/**
 * Admin allowlist — single source of truth for "is this user an admin?".
 *
 * Admins are listed in ADMIN_USER_IDS (comma-separated Roblox user ids). Empty
 * means nobody is an admin, so privileged endpoints become no-ops rather than a
 * privilege-escalation hole. Used by /api/usage, /api/admin/*, and the
 * extension test endpoint.
 */
export function isAdmin(userId: string | undefined | null): boolean {
  if (!userId) return false;
  const ids = (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(userId);
}
