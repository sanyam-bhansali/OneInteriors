import type { Entry } from './entry';

/** Quotation items in the app (owner, 10 Nov 2026), English, Hindi and Marathi (first draft for review). */
export const itemWords = {
  'item.hint': { en: 'Shows a photo of it', hi: 'इसकी फ़ोटो दिखाता है', mr: 'याचा फोटो दाखवते' },
  'item.open': { en: 'See what it is', hi: 'देखें यह क्या है', mr: 'हे काय आहे ते पाहा' },
  'item.noPhoto': { en: 'Photo coming soon', hi: 'फ़ोटो जल्द आएगी', mr: 'फोटो लवकरच येईल' },
  'item.close': { en: 'Close', hi: 'बंद करें', mr: 'बंद करा' },
} satisfies Record<string, Entry>;
