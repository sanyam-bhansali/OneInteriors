import { afterEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { bearerFrom } from '@/modules/auth/bearer';
import { briefFromJson } from '@/modules/brief/from-json';
import { EMPTY_BRIEF } from '@/modules/brief/types';

/**
 * The phone app's API (docs/MOBILE-APP-PLAN.md): its token parsing, the
 * brief it accepts over the wire, and the customer gate every route must
 * carry because `/api` is always routed.
 */

describe('reading a bearer token', () => {
  const token = 'a'.repeat(43);

  it('takes a well-formed header', () => {
    expect(bearerFrom(`Bearer ${token}`)).toBe(token);
  });

  it('ignores anything else', () => {
    expect(bearerFrom(null)).toBeNull();
    expect(bearerFrom('')).toBeNull();
    expect(bearerFrom(token)).toBeNull();
    expect(bearerFrom(`bearer ${token}`)).toBeNull();
    expect(bearerFrom(`Basic ${token}`)).toBeNull();
    expect(bearerFrom('Bearer short')).toBeNull();
    expect(bearerFrom(`Bearer ${token} extra`)).toBeNull();
    expect(bearerFrom(`Bearer ${token.slice(0, 40)}=;`)).toBeNull();
  });
});

describe('a brief from the app', () => {
  it('refuses what is not an object', () => {
    expect(briefFromJson(null)).toBeNull();
    expect(briefFromJson('brief')).toBeNull();
    expect(briefFromJson([])).toBeNull();
  });

  it('fills what is missing from the empty brief', () => {
    expect(briefFromJson({})).toEqual(EMPTY_BRIEF);
  });

  it('keeps good answers', () => {
    const b = briefFromJson({ propertyType: 'BHK_2', carpetAreaSqft: 850, styleLikes: ['MODERN'] })!;
    expect(b.propertyType).toBe('BHK_2');
    expect(b.carpetAreaSqft).toBe(850);
    expect(b.styleLikes).toEqual(['MODERN']);
  });

  it('empties fields of the wrong type instead of crashing the save', () => {
    const b = briefFromJson({
      scopeRooms: 'KITCHEN',
      needs: [1, 'VASTU'],
      budgetMaxPaise: '9000000',
      carpetAreaSqft: -5,
      household: 'four',
      lastStep: 'three',
    })!;
    expect(b.scopeRooms).toEqual([]);
    expect(b.needs).toEqual(['VASTU']);
    expect(b.budgetMaxPaise).toBeNull();
    expect(b.carpetAreaSqft).toBeNull();
    expect(b.household).toBeNull();
    expect(b.lastStep).toBe(0);
  });

  it('never takes a floor-plan reading from the client', () => {
    const b = briefFromJson({ planReading: { bathrooms: 9 }, floorPlanName: 'x.pdf', foo: 1 })!;
    expect(b.planReading).toBeNull();
    expect(b.floorPlanName).toBeNull();
    expect('foo' in b).toBe(false);
  });
});

describe('the app API is closed until the marketplace opens', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('answers 404 while CUSTOMER_LIVE is unset', async () => {
    vi.stubEnv('CUSTOMER_LIVE', '');
    const { gate } = await import('@/modules/app-api/http');
    const g = gate();
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.response.status).toBe(404);
  });

  it('every route checks the gate first', () => {
    const root = join(process.cwd(), 'src/app/api/app');
    const routes: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (name === 'route.ts') routes.push(path);
      }
    };
    walk(root);
    expect(routes.length).toBeGreaterThan(0);
    for (const path of routes) {
      const source = readFileSync(path, 'utf8');
      const handlers = source.match(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g) ?? [];
      const gates = source.match(/const g = gate\(\);\n\s+if \(!g\.ok\) return g\.response;/g) ?? [];
      expect(gates.length, path).toBe(handlers.length);
    }
  });
});
