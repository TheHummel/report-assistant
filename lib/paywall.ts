// List of emails that have unlimited edit access
const UNLIMITED_EDIT_EMAILS: readonly string[] = [];

const unlimitedEmailSet = new Set(
  UNLIMITED_EDIT_EMAILS.map((email) => email.toLowerCase())
);

export function hasUnlimitedEdits(email?: string | null): boolean {
  if (!email) {
    return false;
  }

  return unlimitedEmailSet.has(email.toLowerCase());
}

export const unlimitedEditEmails = UNLIMITED_EDIT_EMAILS;
