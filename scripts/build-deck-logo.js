/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script, run directly, outside the Next module graph */

/**
 * Rasterise the logotype from brand.tsx into docs/assets, for the decks.
 *
 *   node scripts/build-deck-logo.js
 *
 * Paths are relative to this file. They were absolute paths into the sandbox
 * the script was first written in, so it could not run anywhere else.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const OUT_DIR = path.join(REPO, 'docs', 'assets');
const src = fs.readFileSync(path.join(REPO, 'src', 'components', 'brand.tsx'), 'utf8');
const g = (n) => {
  const m = src.match(new RegExp(`const ${n} =\\s*\\n?\\s*'([^']*)'`)) || src.match(new RegExp(`const ${n} = (\\d+);`));
  if(!m) throw new Error('missing '+n); return m[1];
};
const D = g('LOGO_D'), W = +g('LOGO_W'), H = +g('LOGO_H');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME, args:['--no-sandbox','--disable-dev-shm-usage'] });
  for (const [name, fill] of [['logo-ink','#2C2624'], ['logo-light','#EFEAE3']]) {
    const p = await b.newPage({ viewport: { width: Math.round(W/4), height: Math.round(H/4) }, deviceScaleFactor: 4 });
    await p.setContent(`<html><body style="margin:0;background:transparent">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W/4}" height="${H/4}" style="display:block">
        <path fill-rule="evenodd" fill="${fill}" d="${D}"/></svg></body></html>`);
    // deviceScaleFactor 4: the 1072-unit mark renders about 4,300px wide, plenty for print.
    const out = path.join(OUT_DIR, `${name}.png`);
    await p.screenshot({ path: out, omitBackground: true });
    await p.close();
    console.log(name, fs.statSync(out).size);
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
