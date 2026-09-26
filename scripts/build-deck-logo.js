const { chromium } = require('/sessions/wonderful-laughing-albattani/mnt/OneInteriors/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const src = fs.readFileSync('/sessions/wonderful-laughing-albattani/mnt/OneInteriors/src/components/brand.tsx','utf8');
const g = (n) => {
  const m = src.match(new RegExp(`const ${n} =\\s*\\n?\\s*'([^']*)'`)) || src.match(new RegExp(`const ${n} = (\\d+);`));
  if(!m) throw new Error('missing '+n); return m[1];
};
const D = g('LOGO_D'), W = +g('LOGO_W'), H = +g('LOGO_H');
const SCALE = 4;               // 1072*4 ≈ 4288px wide — plenty for print
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME, args:['--no-sandbox','--disable-dev-shm-usage'] });
  for (const [name, fill] of [['logo-ink','#2C2624'], ['logo-light','#EFEAE3']]) {
    const p = await b.newPage({ viewport: { width: Math.round(W/4), height: Math.round(H/4) }, deviceScaleFactor: 4 });
    await p.setContent(`<html><body style="margin:0;background:transparent">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W/4}" height="${H/4}" style="display:block">
        <path fill-rule="evenodd" fill="${fill}" d="${D}"/></svg></body></html>`);
    await p.screenshot({ path: `/tmp/${name}.png`, omitBackground: true });
    await p.close();
    console.log(name, fs.statSync(`/tmp/${name}.png`).size);
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
