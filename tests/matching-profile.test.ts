import { describe, it, expect } from 'vitest';
import {
  EMPTY_PROFILE,
  cleanVideoUrl,
  earliestStartKnown,
  profileFromForm,
  profileScore,
  profileSections,
  readProfile,
  type FormLike,
} from '@/modules/studio/matching-profile';

const TODAY = '2026-09-29';

function form(entries: [string, string][]): FormLike {
  return {
    get: (n) => entries.find(([k]) => k === n)?.[1] ?? null,
    getAll: (n) => entries.filter(([k]) => k === n).map(([, v]) => v),
  };
}

const FULL: [string, string][] = [
  ['workMix', 'MIXED'],
  ['scopes', 'FULL_HOME'],
  ['scopes', 'RENOVATION'],
  ['minimum_FULL_HOME', '8'],
  ['minimum_RENOVATION', '4.5'],
  ['duration_FULL_HOME', '90'],
  ['duration_RENOVATION', '60'],
  ['civil', 'PARTNER'],
  ['homeTypes', 'BHK_2'],
  ['homeTypes', 'BHK_3'],
  ['cityWide', 'no'],
  ['societies', 'Gera World of Joy, Kolte Patil Life Republic'],
  ['concurrentProjects', '6'],
  ['runningNow', '4'],
  ['earliestStart', '2026-11-01'],
  ['designBeforePossession', 'yes'],
  ['workingStyle', 'COLLABORATE'],
  ['revisions', '3'],
  ['views3d', 'KEY_ROOMS'],
  ['dedicatedDesigner', 'yes'],
  ['dedicatedPM', 'no'],
  ['updates', 'WHATSAPP'],
  ['carcass', 'BWP_PLY'],
  ['finishes', 'LAMINATE'],
  ['finishes', 'ACRYLIC'],
  ['hardware', 'Hettich\nHettich\nHäfele'],
  ['warrantyYears', '10'],
  ['production', 'OWN_FACTORY'],
  ['ownInstallers', 'yes'],
  ['specialisms', 'CHILDREN'],
  ['languages', 'MR'],
  ['introVideoUrl', 'https://youtu.be/abc'],
];

describe('profileFromForm', () => {
  it('reads a complete form and every required section is done', () => {
    const { profile, errors } = profileFromForm(form(FULL), TODAY, EMPTY_PROFILE);
    expect(errors).toEqual({});
    expect(profile.minimumLakhs).toEqual({ FULL_HOME: 8, RENOVATION: 4.5 });
    expect(profile.societies).toEqual(['Gera World of Joy', 'Kolte Patil Life Republic']);
    expect(profile.hardware).toEqual(['Hettich', 'Häfele']);
    expect(profile.earliestStartSetOn).toBe(TODAY);
    const sections = profileSections(profile, ['Kharadi'], TODAY);
    expect(sections.filter((s) => s.required).every((s) => s.done)).toBe(true);
    expect(profileScore(sections)).toBe(100);
  });

  it('allows blank, refuses present-and-wrong', () => {
    const { errors } = profileFromForm(
      form([['scopes', 'FULL_HOME'], ['minimum_FULL_HOME', '0.1'], ['introVideoUrl', 'http://evil.example/x'], ['concurrentProjects', '2'], ['runningNow', '9']]),
      TODAY,
      EMPTY_PROFILE,
    );
    expect(Object.keys(errors).sort()).toEqual(['introVideoUrl', 'minimum_FULL_HOME', 'runningNow']);
  });

  it('keeps the curated discount out of the studio’s hands', () => {
    const previous = { ...EMPTY_PROFILE, curatedDiscountPct: 5 };
    const { profile } = profileFromForm(form([...FULL, ['curatedDiscountPct', '25']]), TODAY, previous);
    expect(profile.curatedDiscountPct).toBe(5);
  });

  it('asks about civil work only when they take renovation', () => {
    const { profile } = profileFromForm(form([['scopes', 'FULL_HOME'], ['civil', 'OWN_TEAM']]), TODAY, EMPTY_PROFILE);
    expect(profile.civil).toBeNull();
  });
});

describe('readProfile', () => {
  it('drops anything it does not recognise', () => {
    const p = readProfile({ workMix: 'ROBOTS', scopes: ['FULL_HOME', 'MARS'], languages: ['MR', 'FR'], warrantyYears: 900, introVideoUrl: 'javascript:alert(1)' });
    expect(p.workMix).toBeNull();
    expect(p.scopes).toEqual(['FULL_HOME']);
    expect(p.languages).toEqual(['MR']);
    expect(p.warrantyYears).toBeNull();
    expect(p.introVideoUrl).toBeNull();
    expect(readProfile(null)).toEqual(EMPTY_PROFILE);
  });

  it('round-trips a profile from the form', () => {
    const { profile } = profileFromForm(form(FULL), TODAY, EMPTY_PROFILE);
    expect(readProfile(JSON.parse(JSON.stringify(profile)))).toEqual(profile);
  });
});

describe('earliestStartKnown', () => {
  it('goes stale after sixty days unconfirmed', () => {
    const p = { ...EMPTY_PROFILE, earliestStart: '2026-11-01', earliestStartSetOn: '2026-07-01' };
    expect(earliestStartKnown(p, TODAY)).toBeNull();
    expect(earliestStartKnown({ ...p, earliestStartSetOn: '2026-09-01' }, TODAY)).toBe('2026-11-01');
  });
});

describe('profileSections', () => {
  it('does not ask a carpentry studio for a factory or hardware brands', () => {
    const p = { ...EMPTY_PROFILE, workMix: 'CARPENTRY' as const, carcass: ['BWP_PLY' as const], finishes: ['LAMINATE' as const], warrantyYears: 5 };
    expect(profileSections(p, [], TODAY).find((s) => s.id === 'materials')!.done).toBe(true);
  });
  it('recommended sections never block', () => {
    const s = profileSections(EMPTY_PROFILE, [], TODAY);
    expect(s.filter((x) => !x.required).map((x) => x.id)).toEqual(['experience', 'languages', 'video']);
  });
});

describe('cleanVideoUrl', () => {
  it('accepts only https links to video hosts', () => {
    expect(cleanVideoUrl('https://www.youtube.com/watch?v=x')).toBe('https://www.youtube.com/watch?v=x');
    expect(cleanVideoUrl('https://example.com/v.mp4')).toBeNull();
    expect(cleanVideoUrl('not a url')).toBeNull();
  });
});
