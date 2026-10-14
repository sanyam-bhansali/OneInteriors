/**
 * The studio theme's key and the pre-paint script, in a plain module so the
 * server layout can inline the script (a 'use client' module's exports reach a
 * server component only as client references, not as strings).
 */
export const THEME_KEY = 'oi-studio-theme';

/** Runs before paint (an inline <script> at the top of the studio frame). Light unless the person chose dark. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light')}catch(e){document.documentElement.setAttribute('data-theme','light')}`;
