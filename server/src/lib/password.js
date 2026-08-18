import bcrypt from 'bcryptjs';

/**
 * Verifies an admin password candidate against the configured credential.
 *
 * Kept as a pure function (credentials passed in rather than read from config) so both
 * branches are testable without juggling process env: `config` is a module singleton
 * read once at import, so a test cannot flip it between cases.
 *
 * @param {string} candidate password supplied by the client
 * @param {{ hash?: string|null, plaintext?: string|null }} credential configured admin credential
 */
export async function verifyPassword(candidate, { hash = null, plaintext = null } = {}) {
  if (typeof candidate !== 'string' || candidate.length === 0) return false;

  // bcrypt hash is the supported production form.
  if (hash) {
    try {
      return await bcrypt.compare(candidate, hash);
    } catch {
      // A malformed hash must fail closed, not throw a 500 on every login attempt.
      return false;
    }
  }

  // Plaintext is the local-development fallback only.
  if (plaintext) return candidate === plaintext;

  return false;
}

export default verifyPassword;
