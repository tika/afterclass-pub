const SUPER_ADMIN_EMAILS_ENV = "SUPER_ADMIN_EMAILS";

/**
 * Super-admin email allowlist, sourced from the `SUPER_ADMIN_EMAILS` env var
 * (comma-separated). Kept out of source control so the list of privileged
 * accounts is never published with the repository.
 */
export const superAdminEmails: readonly string[] = (process.env[SUPER_ADMIN_EMAILS_ENV] ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter((email) => email.length > 0);

/** Returns true when the given email is configured as a super admin. */
export const isSuperAdmin = (email: string | null | undefined): boolean =>
  email != null && superAdminEmails.includes(email.toLowerCase());
