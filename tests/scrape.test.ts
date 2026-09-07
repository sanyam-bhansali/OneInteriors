import { describe, it, expect } from 'vitest';
import { extract, normaliseUrl } from '@/modules/studio/scrape';

/**
 * Fixtures modelled on the two real Pune studio sites we read while building
 * this — a Next.js site with a rich footer, and a page-builder site whose
 * prices carry no rupee glyph. Between them they cover most of what a Pune
 * interiors site does.
 */
const HAUSPIRE_LIKE = `
<html><head>
<title>Hauspire — Home Interiors from Our Own Factory in Pune</title>
<meta name="description" content="Every piece in your home designed, made and fitted by one team, in our own Balewadi factory.">
<meta property="og:title" content="Hauspire — Home Interiors from Our Own Factory in Pune">
<meta property="og:description" content="Fixed price, 45-day handover, 10-year written warranty.">
</head><body>
<a href="tel:+917666645800">+91 766 664 5800</a>
<a href="mailto:info@hauspire.com">info@hauspire.com</a>
<a href="https://wa.me/917666645800">WhatsApp</a>
<a href="https://www.instagram.com/hauspiredesignstudio/">Instagram</a>
<a href="/interior-designers-in-baner">Baner</a>
<a href="/interior-designers-in-wakad">Wakad</a>
<a href="/interior-designers-in-hinjewadi">Hinjewadi</a>
<a href="/interior-designers-in-kharadi">Kharadi</a>
<a href="/interior-designers-in-kothrud">Kothrud</a>
<p>2 BHK typically around 850 sq ft Starting from ₹ 5.0 L.</p>
<p>1 BHK typically around 550 sq ft Starting from ₹ 3.5 L.</p>
<p>Ready in forty-five days from design sign-off. The 45-day handover goes in the contract.</p>
<p>Ten years, in writing. Our 10-year warranty covers carcass, joinery, finish and fitting.</p>
<footer>© 2026 Hauspire Pvt Ltd · Pune</footer>
<script>var ga = "noreply@sentry.io";</script>
</body></html>`;

const URBANLINE_LIKE = `
<html><head>
<title>Interior Designers in Pune &amp; Pimpri-Chinchwad | Urbanline Interiors</title>
<meta property="og:title" content="Interior Designers in Pune &amp; Pimpri-Chinchwad | Urbanline Interiors">
<meta property="og:description" content="Full home interiors, modular kitchens and renovations across Pune.">
</head><body>
<h3>Economy</h3><p>Starting From - 6 Lakhs*</p>
<h3>Premium</h3><p>Starting From - 9 Lakhs*</p>
<h3>Luxury</h3><p>Starting From - 15 Lakhs*</p>
<p>Call Us +91 7558351003</p>
<a href="tel:+917558351003">Call</a>
<p>Email Us connect@urbanlineinteriors.com</p>
<a href="https://www.instagram.com/urbanlineinteriors/">Instagram</a>
<a href="/interior-designers-in/baner">Interior Designers in Baner</a>
<a href="/interior-designers-in/kharadi">Interior Designers in Kharadi</a>
<a href="/interior-designers-in/viman-nagar">Interior Designers in Viman Nagar</a>
<p>10-Year Warranty Assurance. On-Time Delivery Guarantee.</p>
<footer>© 2016–2026 Urbanline Interiors. All rights reserved.</footer>
</body></html>`;

describe('normaliseUrl', () => {
  it('adds a scheme when someone types a bare domain', () => {
    expect(normaliseUrl('hauspire.com')).toBe('https://hauspire.com/');
  });

  it('keeps an explicit scheme', () => {
    expect(normaliseUrl('http://example.com/work')).toBe('http://example.com/work');
  });

  it('rejects anything that is not a public web address', () => {
    expect(normaliseUrl('')).toBeNull();
    expect(normaliseUrl('   ')).toBeNull();
    expect(normaliseUrl('file:///etc/passwd')).toBeNull();
    expect(normaliseUrl('notadomain')).toBeNull();
  });

  // This URL comes from a public form, so it is attacker-controlled. Fetching
  // it must never reach our own network.
  it('refuses private and loopback hosts', () => {
    expect(normaliseUrl('http://localhost:3000')).toBeNull();
    expect(normaliseUrl('http://127.0.0.1')).toBeNull();
    expect(normaliseUrl('http://10.0.0.5')).toBeNull();
    expect(normaliseUrl('http://192.168.1.1')).toBeNull();
    expect(normaliseUrl('http://172.16.4.2')).toBeNull();
    expect(normaliseUrl('http://169.254.169.254')).toBeNull();
  });
});

describe('extract — a Next.js studio site', () => {
  const site = extract(HAUSPIRE_LIKE, 'https://hauspire.com');

  it('prefers og:title over <title>', () => {
    expect(site.title).toContain('Hauspire');
  });

  it('finds the linked email and drops analytics noise', () => {
    expect(site.emails).toContain('info@hauspire.com');
    expect(site.emails.join()).not.toContain('sentry');
  });

  it('normalises phone numbers from tel: and wa.me to one shape', () => {
    expect(site.phones).toContain('+917666645800');
    expect(new Set(site.phones).size).toBe(site.phones.length);
  });

  it('reads the Instagram handle, not the /p/ or /reel/ path', () => {
    expect(site.instagram).toBe('@hauspiredesignstudio');
  });

  it('maps mentioned areas onto our locality slugs', () => {
    expect(site.localities).toEqual(
      expect.arrayContaining(['baner', 'wakad', 'hinjewadi', 'kharadi', 'kothrud']),
    );
  });

  it('takes the LOWEST advertised starting price, in paise', () => {
    // ₹3.5 L, not ₹5.0 L — the entry price is what a customer will hold them to.
    expect(site.startingFromPaise).toBe(35_000_000);
  });

  it('collects the promises we will have to verify', () => {
    expect(site.claims.join(' ')).toMatch(/45-day handover|10-year warranty/i);
  });

  it('never presents any of this as verified', () => {
    expect(site.source).toBe('website-claim');
  });
});

describe('extract — a page-builder studio site', () => {
  const site = extract(URBANLINE_LIKE, 'https://urbanlineinteriors.com');

  it('reads a starting price written without a rupee glyph', () => {
    expect(site.startingFromPaise).toBe(60_000_000); // ₹6 lakh
  });

  it('finds an email that is only in body text', () => {
    expect(site.emails).toContain('connect@urbanlineinteriors.com');
  });

  it('derives years active from a copyright range', () => {
    // © 2016–2026
    expect(site.yearsActive).toBe(new Date().getFullYear() - 2016);
  });

  it('decodes entities in the title', () => {
    expect(site.title).toContain('&');
    expect(site.title).not.toContain('&amp;');
  });
});

/**
 * Every case here is a defect the scraper actually produced the first time it
 * ran against the two live sites. They are regressions, not hypotheticals.
 */
describe('extract — defects found running against real sites', () => {
  it('decodes numeric and hex entities inside claims', () => {
    // A Next.js page emits &#x27; for an apostrophe; it was appearing verbatim
    // inside the quoted promises shown to ops.
    const site = extract(
      `<p>We give a 10-year warranty in writing, and we don&#39;t move the price. It&#x27;s a fixed price we won&#x27;t revisit.</p>`,
      'https://example.com',
    );
    const claims = site.claims.join(' ');
    expect(claims).toContain("don't");
    expect(claims).toContain("It's");
    expect(claims).not.toContain('&#x27;');
    expect(claims).not.toContain('&#39;');
  });

  it('reads a promise set with a typographer&rsquo;s non-breaking hyphen', () => {
    // "10‑year" with U+2011 looks identical to a person and matches nothing.
    const site = extract(
      '<p>We give a 10‑year warranty in writing on everything we make.</p>',
      'https://example.com',
    );
    expect(site.claims.length).toBe(1);
  });

  it('does not file an FAQ question as a promise', () => {
    // "What does the ten-year warranty cover?" is the studio asking, not promising.
    const site = extract(
      '<p>What does the ten-year warranty cover?</p>',
      'https://example.com',
    );
    expect(site.claims).toEqual([]);
  });

  it('catches a promise spelled out in words, not just digits', () => {
    const site = extract(
      '<p>Ready in forty-five days from design sign-off, and the date goes in the contract.</p>',
      'https://example.com',
    );
    expect(site.claims.length).toBeGreaterThan(0);
  });

  it('reads the meta description, where the sharpest promise often lives', () => {
    const site = extract(
      `<html><head><meta name="description" content="Fixed price, 45-day handover, 10-year written warranty."></head><body><p>Nothing here.</p></body></html>`,
      'https://example.com',
    );
    expect(site.claims.join(' ')).toContain('45-day handover');
  });
});

describe('extract — degrades quietly', () => {
  it('returns nulls rather than throwing on an empty page', () => {
    const site = extract('<html><body></body></html>', 'https://example.com');
    expect(site.title).toBeNull();
    expect(site.startingFromPaise).toBeNull();
    expect(site.yearsActive).toBeNull();
    expect(site.emails).toEqual([]);
    expect(site.localities).toEqual([]);
  });

  it('does not match a locality inside a longer word', () => {
    const site = extract('<p>Contact Mr Banerjee about Aundhkar Road</p>', 'https://example.com');
    expect(site.localities).not.toContain('baner');
  });
});
