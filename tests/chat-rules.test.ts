import { describe, expect, it } from 'vitest';
import { isArchived, kindForFile, kindsFor, mayTakeBack, messageProblem, previewOf, roleWord, searchTerm, snagTitleFrom, threadTitle, tickFor, unreadCount, type ChatViewer } from '@/modules/chat/rules';

/** In-app chat (owner, 1 Nov 2026): who sees which conversation, and what a message may be. */
describe('who sees which conversation', () => {
  const studio = (o: Partial<Extract<ChatViewer, { side: 'STUDIO' }>>): ChatViewer => ({
    side: 'STUDIO',
    userId: 's',
    role: 'SUPERVISOR',
    designHead: false,
    isProjectDesigner: false,
    onProject: true,
    ...o,
  });

  it('gives the client all three, family the home team, our team only ours', () => {
    expect(kindsFor({ side: 'CLIENT', userId: 'c' })).toEqual(['DESIGNER', 'TEAM', 'ONE_INTERIORS']);
    expect(kindsFor({ side: 'FAMILY', userId: 'f' })).toEqual(['TEAM']);
    expect(kindsFor({ side: 'ONE_INTERIORS', userId: 'o' })).toEqual(['ONE_INTERIORS']);
  });

  it('lets the designer, owner, design head and PMs into the designer conversation; the site head only the home team', () => {
    expect(kindsFor(studio({ isProjectDesigner: true, role: 'DESIGNER' }))).toEqual(['DESIGNER', 'TEAM']);
    expect(kindsFor(studio({ role: 'OWNER' }))).toEqual(['DESIGNER', 'TEAM']);
    expect(kindsFor(studio({ role: 'PM' }))).toEqual(['DESIGNER', 'TEAM']);
    expect(kindsFor(studio({ role: 'DESIGNER', designHead: true }))).toEqual(['DESIGNER', 'TEAM']);
    expect(kindsFor(studio({ role: 'SUPERVISOR' }))).toEqual(['TEAM']);
    expect(kindsFor(studio({ role: 'DESIGNER' }))).toEqual(['TEAM']);
  });

  it('never shows a studio person a project they are not on, nor ours to any studio', () => {
    expect(kindsFor(studio({ role: 'OWNER', onProject: false }))).toEqual([]);
    expect(kindsFor(studio({ role: 'OWNER' }))).not.toContain('ONE_INTERIORS');
  });
});

describe('a message', () => {
  it('needs words, or a file for a photo, voice note or PDF', () => {
    expect(messageProblem({ body: '  ', kind: 'TEXT', hasFile: false, durationMs: null })).toMatch(/Write/);
    expect(messageProblem({ body: '', kind: 'VOICE', hasFile: false, durationMs: 3000 })).toMatch(/voice/i);
    expect(messageProblem({ body: '', kind: 'PHOTO', hasFile: true, durationMs: null })).toBeNull();
    expect(messageProblem({ body: 'x'.repeat(4001), kind: 'TEXT', hasFile: false, durationMs: null })).toMatch(/4,000/);
    expect(messageProblem({ body: '', kind: 'VOICE', hasFile: true, durationMs: 6 * 60_000 })).toMatch(/five minutes/);
  });

  it('takes photos, voice notes and PDFs, nothing else', () => {
    expect(kindForFile('image/jpeg')).toBe('PHOTO');
    expect(kindForFile('audio/mp4')).toBe('VOICE');
    expect(kindForFile('application/pdf')).toBe('FILE');
    expect(kindForFile('application/zip')).toBeNull();
  });

  it('previews what it carries', () => {
    expect(previewOf({ kind: 'VOICE', body: '', durationMs: 42_000 })).toBe('Voice note 0:42');
    expect(previewOf({ kind: 'PHOTO', body: 'the loft' })).toBe('Photo: the loft');
    expect(previewOf({ kind: 'TEXT', body: 'hi', deletedAt: new Date() })).toBe('Message taken back');
  });
});

describe('unread and ticks', () => {
  const t0 = new Date('2026-11-01T10:00:00Z');
  const t1 = new Date('2026-11-01T10:05:00Z');

  it('counts others’ messages after I last read', () => {
    const msgs = [
      { createdAt: t0, authorId: 'a' },
      { createdAt: t1, authorId: 'a' },
      { createdAt: t1, authorId: 'me' },
    ];
    expect(unreadCount(msgs, 'me', null)).toBe(2);
    expect(unreadCount(msgs, 'me', t0)).toBe(1);
  });

  it('shows delivered once their app has it, and read once anyone else has read past it', () => {
    expect(tickFor(t1, [t0])).toBe('sent');
    expect(tickFor(t1, [t0], [t1])).toBe('delivered');
    expect(tickFor(t0, [t1], [t1])).toBe('read');
  });

  it('keeps an archived conversation hidden until a newer message', () => {
    expect(isArchived(t1, t0)).toBe(true);
    expect(isArchived(t0, t1)).toBe(false);
    expect(isArchived(null, t1)).toBe(false);
  });

  it('lets the author take a message back within the hour only', () => {
    const m = { authorId: 'me', createdAt: t0, deletedAt: null };
    expect(mayTakeBack(m, 'me', new Date(t0.getTime() + 59 * 60_000))).toBe(true);
    expect(mayTakeBack(m, 'me', new Date(t0.getTime() + 61 * 60_000))).toBe(false);
    expect(mayTakeBack(m, 'other', t0)).toBe(false);
  });
});

describe('names', () => {
  it('says the site head as the client knows them', () => {
    expect(roleWord('STUDIO', 'SUPERVISOR')).toBe('Site head');
    expect(roleWord('STUDIO', 'PM', { designer: true })).toBe('Designer');
  });

  it('titles the designer conversation by the designer for the client, and by the home for the studio', () => {
    expect(threadTitle('DESIGNER', { designer: 'Renuka', home: 'VTP Cygnus', studio: 'Hauspire', side: 'CLIENT' })).toBe('Renuka');
    expect(threadTitle('DESIGNER', { designer: 'Renuka', home: 'VTP Cygnus', studio: 'Hauspire', side: 'STUDIO' })).toBe('VTP Cygnus · Client');
  });
});

describe('search and snags from the chat', () => {
  it('searches two characters or more', () => {
    expect(searchTerm('a')).toBeNull();
    expect(searchTerm('  loft  ')).toBe('loft');
  });

  it('makes a snag title from the first line, at most 120 characters', () => {
    expect(snagTitleFrom('Gap above the wardrobe\nI can see the wall')).toBe('Gap above the wardrobe');
    expect(snagTitleFrom('x'.repeat(200))).toHaveLength(118);
    expect(snagTitleFrom('  ')).toBe('From the chat');
  });
});
