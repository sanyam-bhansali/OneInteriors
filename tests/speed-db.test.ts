import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_POOL_SIZE, poolSize, withPoolSize } from '@/lib/db-url';

/** Speed (owner, 14 Nov 2026: "the loading speed is very slow"). */

const POOLER = 'postgresql://u:p@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1';

describe('connections per server', () => {
  it('raises a limit of one so queries asked for together run together', () => {
    const url = new URL(withPoolSize(POOLER, 5)!);
    expect(url.searchParams.get('connection_limit')).toBe('5');
    expect(url.searchParams.get('pgbouncer')).toBe('true');
    expect(url.hostname).toBe('aws-0-ap-south-1.pooler.supabase.com');
  });
  it('never lowers a limit, and leaves an address without one alone', () => {
    expect(withPoolSize(POOLER.replace('connection_limit=1', 'connection_limit=8'), 5)).toBeNull();
    expect(withPoolSize('postgresql://u:p@db.example.com:5432/postgres', 5)).toBeNull();
  });
  it('leaves the local test database alone (one connection)', () => {
    expect(withPoolSize('postgresql://postgres:postgres@127.0.0.1:54329/postgres?connection_limit=1&pgbouncer=true', 5)).toBeNull();
    expect(withPoolSize('postgresql://postgres:postgres@localhost:5432/postgres?connection_limit=1', 5)).toBeNull();
  });
  it('ignores what is not an address', () => {
    expect(withPoolSize(undefined, 5)).toBeNull();
    expect(withPoolSize('not a url', 5)).toBeNull();
  });
  it('is five unless DB_POOL_SIZE says otherwise (1 to 20)', () => {
    expect(poolSize({})).toBe(DEFAULT_POOL_SIZE);
    expect(DEFAULT_POOL_SIZE).toBe(5);
    expect(poolSize({ DB_POOL_SIZE: '8' })).toBe(8);
    expect(poolSize({ DB_POOL_SIZE: '0' })).toBe(5);
    expect(poolSize({ DB_POOL_SIZE: '500' })).toBe(5);
  });
});

describe('source guards', () => {
  const read = (p: string) => readFileSync(p, 'utf8');
  it('the signed-in person, their membership and their studio are read once per page', () => {
    expect(read('src/modules/auth/session.ts')).toMatch(/export const getCurrentUser = cache\(readCurrentUser\)/);
    expect(read('src/modules/studio/access.ts')).toMatch(/export const currentMember = cache\(readCurrentMember\)/);
    expect(read('src/modules/studio/access.ts')).toMatch(/export const memberFor = cache\(/);
    expect(read('src/modules/studio/tenancy.ts')).toMatch(/export const myStudioId = cache\(readMyStudioId\)/);
  });
  it('the Prisma client uses the raised limit', () => {
    expect(read('src/lib/prisma.ts')).toMatch(/withPoolSize\(process\.env\.DATABASE_URL, poolSize\(\)\)/);
  });
  it('studio pages show a loading screen at once', () => {
    expect(read('src/app/studio/loading.tsx')).toMatch(/export default function StudioLoading/);
  });
});
