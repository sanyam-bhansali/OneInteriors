/**
 * Pune societies the brief's society field suggests, with the area each is in
 * (build queue item 7).
 *
 * ## A starting list, checked by hand
 *
 * Well-known societies and townships whose area we are sure of, entered on
 * 30 Sep 2026. It is deliberately short: a wrong area here would send a
 * customer's brief to the wrong part of the city, which is worse than no
 * suggestion. Ops should add to it as briefs and studio portfolios name more
 * buildings — a name typed that is not here is still accepted as typed.
 *
 * `aliases` are the other ways people write the same building; all of them
 * resolve to `name`, so "they have done a home in your society" and the
 * floor-plan library see one building, not three spellings.
 */

export interface PuneSociety {
  name: string;
  /** A slug from PUNE_LOCALITIES. */
  locality: string;
  aliases?: string[];
}

export const PUNE_SOCIETIES: PuneSociety[] = [
  // ── Kharadi ──
  { name: 'Gera World of Joy', locality: 'kharadi', aliases: ['World of Joy', 'Gera WOJ'] },
  { name: 'Nyati Elysia', locality: 'kharadi' },
  { name: 'Marvel Zephyr', locality: 'kharadi' },
  { name: 'Panchshil Towers', locality: 'kharadi' },
  { name: 'Eon Waterfront', locality: 'kharadi', aliases: ['Kolte Patil Eon Waterfront'] },
  { name: 'Kolte Patil Downtown', locality: 'kharadi', aliases: ['Downtown Kharadi'] },
  { name: 'Vascon Forest County', locality: 'kharadi', aliases: ['Forest County'] },
  // ── East ──
  { name: 'Panchshil Trump Towers', locality: 'kalyani-nagar', aliases: ['Trump Towers'] },
  { name: 'Rohan Mithila', locality: 'viman-nagar' },
  { name: 'Godrej Infinity', locality: 'keshav-nagar' },
  { name: 'Kolte Patil Ivy Estate', locality: 'wagholi', aliases: ['Ivy Estate'] },
  { name: 'Magarpatta City', locality: 'magarpatta', aliases: ['Magarpatta'] },
  { name: 'Amanora Park Town', locality: 'amanora', aliases: ['Amanora'] },
  { name: 'Kumar Pebble Park', locality: 'hadapsar' },
  // ── South ──
  { name: 'Godrej Prana', locality: 'undri' },
  // ── West & PCMC ──
  { name: 'Paranjape Blue Ridge', locality: 'hinjewadi', aliases: ['Blue Ridge'] },
  { name: 'Megapolis', locality: 'hinjewadi', aliases: ['Xrbia Megapolis', 'Megapolis Hinjewadi'] },
  { name: 'Kolte Patil Life Republic', locality: 'hinjewadi', aliases: ['Life Republic'] },
  { name: 'Kohinoor Tinsel County', locality: 'hinjewadi', aliases: ['Tinsel County'] },
  { name: 'Rohan Leher', locality: 'baner' },
  { name: 'Kalpataru Jade Residences', locality: 'baner', aliases: ['Jade Residences'] },
  { name: 'Mahindra Antheia', locality: 'pimpri', aliases: ['Antheia'] },
  // ── South-west ──
  { name: 'Nanded City', locality: 'nanded-city' },
];
