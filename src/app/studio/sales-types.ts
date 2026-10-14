/** What a Studio OS Phase 1 action says back: done (with the words to show), or why not. */
export type Done = { ok: true; message?: string } | { ok: false; error: string };
