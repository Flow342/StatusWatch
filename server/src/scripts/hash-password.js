import bcrypt from 'bcryptjs';

/**
 * Generates the bcrypt hash for ADMIN_PASSWORD_HASH.
 *
 *   npm run hash-password -- 'my-secret-password'
 *
 * The hash goes in .env; the plaintext password never touches the repo.
 */

const password = process.argv[2];

if (!password) {
  console.error("Usage: npm run hash-password -- 'your-password'");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log(hash);
