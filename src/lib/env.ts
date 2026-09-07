/**
 * Environment reads.
 *
 * Deliberately free of any heavy import — `hasDatabase()` has to be answerable
 * in a build that has no database and no generated Prisma client, so it cannot
 * live in a module that imports `@prisma/client`.
 *
 * Every read here uses a TRUTHINESS check. `??` does not catch the empty string
 * that an unset variable arrives as, and that exact mistake broke a production
 * deploy once already. See CONTRIBUTING.md §8.
 */

function present(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

/** Is a database configured? When false the app serves fixture studios. */
export function hasDatabase(): boolean {
  return present(process.env.DATABASE_URL);
}

/** Is the Prisma CLI able to migrate? Needs the direct (unpooled) connection. */
export function hasDirectDatabase(): boolean {
  return present(process.env.DIRECT_URL);
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
