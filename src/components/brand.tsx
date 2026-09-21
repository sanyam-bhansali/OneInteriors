/**
 * Brand assets — redrawn from the supplied logo, 22 September.
 *
 * The logo is the word "one" in a rounded geometric sans, with two of the
 * three counters replaced: the **o** holds a house, the **e** holds a key.
 * `Mark` is the o. `Logotype` is the full lockup.
 *
 * ## Vector, not the image file
 *
 * Drawn as paths so it is crisp at 16px and at 400px, takes any colour
 * through `currentColor` (so it inverts on Deep Espresso without a second
 * asset), costs no request, and holds up in a quotation PDF — which is
 * where a soft logo is most obvious and least forgivable.
 *
 * ## The wordmark says "One Interiors"
 *
 * The supplied artwork reads "one interior", singular. Everything else —
 * the domain, the page titles, the sender name on every email we send —
 * is plural, so the plural wins and the logo follows it. Left alone, the
 * mismatch would have surfaced on an invoice next to the legal name,
 * which is the worst place to look unsure of your own name.
 *
 * ## Geometry
 *
 * Letters sit on a 40 × 48 box: outer ellipse rx 20 / ry 24, counters
 * inset 9 units, which is the stroke weight throughout. Everything is
 * built from that one number, so the three letters cannot drift apart.
 *
 * The counters are HOLES, not drawn shapes — one path, `fillRule
 * evenodd`, subpaths alternating fill and hole. That is why the house
 * shows the page behind it rather than a hardcoded background, and why
 * the mark works on any surface.
 */

/**
 * The letter body — a superellipse, not an ellipse.
 *
 * The control-point ratio is 0.72 where a true ellipse uses 0.5523. That
 * one number is what makes these letters read as the supplied artwork
 * rather than as generic ovals: it flattens the top and bottom and
 * straightens the sides, which is the whole character of the face. A
 * first pass drawn with real ellipses looked visibly wrong beside the
 * original — too pointed at the crown, too round in the waist.
 *
 * 40 wide, 48 tall, centred on (20, 24).
 */
const BODY =
  'M20 0 C34.4 0 40 6.72 40 24 C40 41.28 34.4 48 20 48 ' +
  'C5.6 48 0 41.28 0 24 C0 6.72 5.6 0 20 0 Z';

/**
 * The house — which IS the o's counter, not a shape sitting inside one.
 *
 * That distinction was the first version's mistake: drawing an oval
 * counter AND a house left the oval visible around the roof, so the o
 * read as a letter with a picture in it. In the artwork the house has
 * replaced the counter entirely, and that is what makes the letter feel
 * drawn rather than decorated.
 *
 * The door is a third subpath. Under `evenodd` it fills again — so it is
 * part of the letter standing in the hole, which is why it reads as a
 * door and not as a notch in the wall.
 */
const HOUSE = 'M20 9 L31.5 20.5 V39 H8.5 V20.5 Z M16.3 39 V30 H23.7 V39 Z';

/**
 * The key — likewise the e's own anatomy rather than an ornament.
 *
 * The bow is the upper counter, domed where a geometric e would be
 * plain. The shaft is the crossbar, with a rounded left cap, and it runs
 * to x=40 — THROUGH the right side rather than up to it. That cut is the
 * e's aperture: a geometric e has to open on the right or it is just an
 * o, and here the key is what opens it. The teeth stop at x=31, clear of
 * the curve, which by their depth has already come in.
 */
const KEY =
  'M20 10 C25.4 10 29.5 14.1 29.5 19.5 V22.5 H10.5 V19.5 C10.5 14.1 14.6 10 20 10 Z ' +
  'M14 25.5 H40 V32 H31 V37.5 H28 V32 H25 V37.5 H22 V32 H14 A3.25 3.25 0 0 1 14 25.5 Z';

/**
 * The n — the one letter the logo leaves alone.
 *
 * Square top-left where the stem meets the top, rounded shoulder on the
 * right. Not symmetrical, and deliberately so: it is what stops the word
 * reading as three identical ovals.
 */
const N =
  'M0 48 V0 H17 C30 0 40 9.5 40 22 V48 H31 V22.5 C31 16 27 12 21 12 H9 V48 Z';

/**
 * The o with the house in it, on a square canvas.
 *
 * Square rather than the letter's own 40 × 48, because this is what goes
 * in a favicon, an avatar, an app icon and a 26px header slot — all of
 * which are square, and a letter-shaped viewBox in a square slot leaves
 * the letter small and floating. The o is centred in 48 × 48 with three
 * units of air either side.
 */
export function Mark({ className = '', title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}

      {/* One path, three subpaths, evenodd: the o fills, the house is a
          hole in it, and the door fills again inside the house. Nothing
          here paints a background colour, so the mark sits on Raw Silk,
          on Deep Espresso, or on a photograph without a second version. */}
      <g transform="translate(4 0)">
        <path fillRule="evenodd" fill="currentColor" d={`${BODY} ${HOUSE}`} />
      </g>
    </svg>
  );
}

/**
 * The full lockup: "one" over "INTERIORS".
 *
 * For the places the mark alone is too quiet — a sign-in screen, the
 * head of a quotation PDF, an email banner, the app's own splash. The
 * three letters are drawn rather than set, so this renders identically
 * whether or not Quicksand has loaded, which matters most in exactly the
 * contexts that do not load webfonts.
 */
export function Logotype({ className = '', title = 'One Interiors' }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 152 82"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>

      <g fill="currentColor" fillRule="evenodd">
        {/* o — house counter */}
        <path d={`${BODY} ${HOUSE}`} />

        {/* n */}
        <path transform="translate(56 0)" d={N} />

        {/* e — key counter */}
        <path transform="translate(112 0)" d={`${BODY} ${KEY}`} />

        {/* "interiors" — lowercase, light, tracked wide, exactly as the
            artwork sets it. Set as text rather than drawn: at this size
            the letterforms carry no weight, and the lockup's character
            is entirely in the three letters above. */}
        <text
          x="76"
          y="76"
          textAnchor="middle"
          fontSize="13"
          letterSpacing="5"
          fontWeight="300"
          fontFamily="var(--font-sans), ui-rounded, system-ui, sans-serif"
        >
          interiors
        </text>
      </g>
    </svg>
  );
}

/**
 * Lockup. The city sits as a locality tag rather than a tagline — this is a
 * one-city product and saying so is a trust signal, not a limitation.
 */
export function Wordmark({
  className = '',
  showCity = true,
}: {
  className?: string;
  showCity?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark className="h-[26px] w-[26px] shrink-0 text-[var(--color-petrol)]" />
      {/* `whitespace-nowrap` on the name, and the city hidden below 400px.
          Under Quicksand — a noticeably wider face than Instrument Sans —
          the wordmark broke to two lines at 375px and left "Pune"
          stranded between the logo and the nav, which reads as a broken
          header rather than as a tight one. The name is one thing and
          must never break; the city is the part that can go. */}
      <span className="flex items-baseline gap-2">
        <span className="font-[family-name:var(--font-display)] whitespace-nowrap text-[21px] leading-none tracking-[-0.01em] text-[var(--color-ink)]">
          One Interiors
        </span>
        {showCity ? (
          <span className="hidden font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.18em] text-[var(--color-ink-3)] min-[400px]:inline">
            Pune
          </span>
        ) : null}
      </span>
    </span>
  );
}
