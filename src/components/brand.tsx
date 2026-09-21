/**
 * Brand assets — the supplied logo, traced from the artwork.
 *
 * The word "one" with two of its three counters replaced: the **o** holds
 * a house, the **e** holds a key. `Mark` is the o alone; `Logotype` is
 * the full lockup with "interiors" beneath it.
 *
 * ## Traced, not redrawn
 *
 * An earlier pass rebuilt these letterforms by hand out of superellipses
 * and got close. Close is the wrong target for a logo: side by side with
 * the artwork the n's shoulder was too square and the key's teeth too
 * short, and every correction after that was a guess checked by eye.
 *
 * These paths are the artwork itself, traced from the supplied 1254px
 * file. The curves ARE the curves, down to the tittle on the i. Nobody
 * has to check them again.
 *
 * Re-tracing after an artwork change: threshold the source above 128,
 * crop to the ink, and run potrace with turdsize 12 / alphamax 1.0 — on
 * the INVERSE of the mask. potracer fills the false regions, so handing
 * it the white-is-true mask returns the background with the letters
 * punched out of it, which looks plausible in a path viewer and is
 * exactly wrong.
 *
 * ## Why vector rather than the image file
 *
 * Crisp at 16px and at 400px. Takes any colour through `currentColor`,
 * so it inverts onto Deep Espresso without a second asset and goes
 * terracotta where that is wanted. No network request and no `public/`
 * directory — the repo still has neither. And it holds up in a quotation
 * PDF, which is where a soft logo is most obvious and least forgivable.
 *
 * The supplied file is also a black JPEG, so on Raw Silk it would have
 * arrived as a black tile with the logo in it.
 *
 * ## The counters are holes
 *
 * One path each, `fillRule="evenodd"`, subpaths alternating fill and
 * hole — so the house and the key show the PAGE through them rather than
 * a painted-in background, and the logo sits on cream, on espresso or on
 * a photograph unchanged.
 */

/** The o with the house. Numbers are the source ink box, used as-is. */
const MARK_W = 329;
const MARK_H = 412;
const MARK_D =
  'M145.0 410.9C65.0 405.1 16.8 357.4 2.3 269.5C0.7 259.8 0.5 251.9 0.5 205.0C0.5 146.1 0.5 146.4 7.2 122.5C15.7 92.5 28.3 70.6 48.9 49.9C76.6 22.2 110.1 6.3 151.0 1.5C207.7 -5.2 259.9 13.9 290.8 52.7C311.7 79.1 324.0 111.3 328.0 150.5C329.8 167.8 328.8 261.7 326.7 274.0C319.7 315.1 306.9 342.1 283.5 365.6C256.3 392.9 222.3 407.7 179.0 411.0C164.1 412.1 161.8 412.1 145.0 410.9ZM136.5 303.8C136.7 303.6 137.2 288.3 137.6 269.7L138.3 236.0L162.7 236.0L187.0 236.0L187.0 270.0L187.0 304.0L218.5 304.0L250.0 304.0L250.0 235.4L250.0 166.8L207.8 123.9C184.6 100.3 165.1 81.1 164.4 81.2C163.8 81.4 145.1 99.1 122.9 120.6C100.7 142.1 80.8 161.2 78.8 163.0L75.0 166.2L75.0 235.4L75.0 304.5L105.6 304.3C122.4 304.2 136.3 304.0 136.5 303.8Z';

/** The full lockup: "one" over "interiors". */
const LOGO_W = 1072;
const LOGO_H = 560;
const LOGO_D =
  'M332.6 558.6C330.5 557.8 327.2 555.7 325.3 553.9C319.8 548.5 319.0 543.9 319.0 517.9L319.0 495.1L312.8 494.8L306.5 494.5L306.2 490.2L305.9 486.0L312.4 486.0L319.0 486.0L319.0 478.0L319.0 470.0L324.0 470.0L329.0 470.0L329.0 478.0L329.0 486.0L341.0 486.0L353.0 486.0L353.0 490.5L353.0 495.0L341.0 495.0L329.0 495.0L329.0 518.2C329.0 545.5 329.5 547.5 336.7 550.0C340.9 551.4 344.7 551.0 351.2 548.5C352.4 548.0 353.3 548.7 354.4 550.9C355.3 552.5 356.0 554.1 356.0 554.4C356.0 554.7 354.2 555.9 352.0 557.0C346.7 559.7 337.6 560.5 332.6 558.6ZM432.9 558.2C422.2 554.6 415.4 548.5 410.6 537.9C398.2 511.0 421.3 480.9 450.6 485.8C468.1 488.7 479.6 501.2 480.8 518.8L481.3 526.0L449.1 526.0C431.5 526.0 417.0 526.1 417.0 526.3C417.0 526.5 417.7 529.0 418.6 531.9C424.1 550.4 448.8 557.1 465.8 544.6L470.7 541.1L473.6 544.1L476.5 547.2L472.5 550.7C465.7 556.7 458.9 559.2 448.0 559.6C440.7 559.9 437.2 559.6 432.9 558.2ZM725.3 558.5C707.4 553.0 696.5 534.8 699.9 516.4C701.4 508.2 703.9 503.2 709.3 497.3C727.1 477.9 761.0 483.0 772.6 506.7C776.2 513.9 777.0 525.9 774.6 534.2C772.8 540.6 767.1 548.7 761.4 553.0C753.2 559.3 736.0 561.9 725.3 558.5ZM934.7 558.9C930.4 557.9 922.4 554.0 919.3 551.4L917.0 549.5L919.8 545.8L922.6 542.2L927.0 545.1C939.7 553.7 960.2 552.9 964.7 543.6C968.3 535.9 963.3 530.3 950.2 527.5C929.6 523.1 923.3 519.6 921.0 510.9C917.6 498.4 927.2 487.4 943.0 485.5C951.8 484.4 965.3 487.6 971.4 492.2C973.2 493.6 973.2 493.8 970.9 497.3C969.6 499.3 968.3 500.8 968.0 500.7C959.6 495.9 955.1 494.6 947.5 494.6C938.3 494.6 933.9 496.3 931.5 501.0C929.2 505.4 929.7 507.9 933.3 511.5C936.0 514.2 938.1 515.1 946.5 516.9C964.6 520.9 970.2 523.7 973.7 530.3C975.8 534.4 975.8 543.5 973.7 547.6C971.3 552.3 965.6 556.7 959.8 558.5C954.2 560.1 940.9 560.4 934.7 558.9ZM113.0 522.5L113.0 486.0L118.0 486.0L123.0 486.0L123.0 522.5L123.0 559.0L118.0 559.0L113.0 559.0L113.0 522.5ZM184.2 522.8L184.5 486.5L189.2 486.2L194.0 485.9L194.0 492.6L194.0 499.4L198.2 495.1C204.8 488.4 211.8 485.6 221.5 485.6C231.7 485.6 238.3 488.3 244.3 495.0C251.3 502.8 252.0 506.3 252.0 534.6L252.0 559.0L247.0 559.0L242.0 559.0L242.0 535.6C242.0 520.9 241.6 511.1 240.9 508.9C235.5 493.0 214.5 489.2 201.9 501.8C194.9 508.9 194.0 512.9 194.0 538.2L194.0 559.0L189.0 559.0L184.0 559.0L184.2 522.8ZM540.2 522.8L540.5 486.5L545.2 486.2L550.0 485.9L550.0 492.6L550.0 499.4L553.4 495.4C557.6 490.4 565.0 486.8 571.7 486.2L577.0 485.8L577.0 490.3L577.0 494.8L572.0 495.5C561.3 497.0 553.2 504.1 551.1 514.0C550.5 516.8 550.0 528.1 550.0 539.0L550.0 559.0L545.0 559.0L540.0 559.0L540.2 522.8ZM631.0 522.5L631.0 486.0L636.0 486.0L641.0 486.0L641.0 522.5L641.0 559.0L636.0 559.0L631.0 559.0L631.0 522.5ZM835.5 557.7C835.2 557.1 835.1 540.7 835.2 521.5L835.5 486.5L840.2 486.2L845.0 485.9L845.0 492.7L845.0 499.4L849.8 494.8C855.6 489.2 859.6 487.1 866.2 486.3C871.9 485.6 873.0 486.5 873.0 491.6C873.0 494.7 872.8 494.8 867.7 495.4C860.3 496.4 852.7 500.9 849.6 506.2C845.9 512.7 845.0 519.4 845.0 540.0L845.0 559.0L840.5 559.0C837.8 559.0 835.7 558.5 835.5 557.7ZM751.9 547.5C761.9 542.0 766.6 533.0 765.8 520.7C765.1 509.8 760.1 502.1 750.6 497.3C743.8 493.8 732.8 493.6 726.0 496.7C720.2 499.3 714.3 505.2 711.6 510.9C708.5 517.8 708.8 528.8 712.3 535.6C715.4 541.6 721.6 547.3 727.4 549.4C734.1 551.9 745.4 551.0 751.9 547.5ZM471.0 515.8C470.9 512.3 467.6 505.9 463.9 502.1C454.5 492.7 438.6 491.7 427.4 499.9C423.4 502.9 418.8 510.0 417.6 515.2L417.0 518.0L444.0 518.0L471.0 518.0L471.0 515.8ZM634.0 472.2C628.9 470.6 627.2 463.8 631.0 460.0C635.5 455.5 643.0 458.9 643.0 465.4C643.0 467.2 642.4 469.2 641.7 469.8C639.7 471.5 635.6 472.8 634.0 472.2ZM112.7 470.2C108.7 465.8 112.0 458.0 117.8 458.0C123.7 458.0 127.4 466.5 123.2 470.3C120.7 472.6 114.7 472.5 112.7 470.2ZM145.0 410.9C65.0 405.1 16.8 357.4 2.3 269.5C0.7 259.8 0.5 251.9 0.5 205.0C0.5 146.1 0.5 146.4 7.2 122.5C15.7 92.5 28.3 70.6 48.9 49.9C76.6 22.2 110.1 6.3 151.0 1.5C207.7 -5.2 259.9 13.9 290.8 52.7C311.7 79.1 324.0 111.3 328.0 150.5C329.8 167.8 328.8 261.7 326.7 274.0C319.7 315.1 306.9 342.1 283.5 365.6C256.3 392.9 222.3 407.7 179.0 411.0C164.1 412.1 161.8 412.1 145.0 410.9ZM887.5 410.3C877.4 409.5 864.6 407.7 855.0 405.5C785.6 390.2 745.0 333.5 737.9 242.0C736.4 221.5 737.3 167.5 739.4 153.1C749.1 88.4 779.0 44.7 830.8 19.0C871.9 -1.4 927.1 -4.7 972.7 10.5C1009.9 22.9 1039.4 51.6 1054.6 90.0C1065.5 117.7 1069.8 143.6 1070.7 186.2L1071.3 213.0L951.9 213.0C870.2 213.0 831.3 213.3 828.6 214.1C823.2 215.6 816.7 222.4 815.1 228.3C813.3 234.6 814.1 245.8 816.7 250.2C817.7 252.0 820.5 254.8 822.9 256.5C826.9 259.3 827.8 259.5 839.3 260.0L851.5 260.5L851.8 298.2L852.0 336.0L867.5 336.0L883.0 336.0L883.0 314.0L883.0 292.0L892.0 292.0L901.0 292.0L901.0 304.5L901.0 317.1L909.2 316.8L917.5 316.5L917.8 304.2L918.1 292.0L927.0 292.0L936.0 292.0L936.0 314.0L936.0 336.0L954.0 336.0L972.0 336.0L972.0 297.5L972.0 259.0L1022.0 259.0L1072.0 259.0L1072.0 266.4C1072.0 282.8 1065.2 310.8 1056.9 328.8C1032.4 381.8 977.3 411.7 905.6 410.8C897.9 410.7 889.7 410.5 887.5 410.3ZM389.2 405.2C388.2 404.5 388.0 364.0 388.2 205.9L388.5 7.5L443.8 7.2L499.0 7.0L499.1 32.7C499.1 53.1 499.4 58.1 500.3 56.7C509.3 42.8 512.3 38.7 517.8 32.8C540.1 9.2 571.8 -1.7 607.6 1.9C623.7 3.4 633.3 6.0 645.5 12.0C666.9 22.4 681.6 39.8 689.9 64.6C696.2 83.4 696.0 77.3 696.1 248.4C696.1 334.0 695.8 404.4 695.5 405.0C695.1 405.6 675.5 406.0 639.9 406.0L585.0 406.0L584.8 251.8L584.5 97.5L552.3 97.3L520.0 97.1L519.4 99.8C516.2 114.4 512.1 122.6 503.7 131.0C491.9 142.8 476.5 148.0 453.5 148.0L441.0 148.0L441.0 173.5L441.0 199.0L469.5 199.0L498.0 199.0L498.0 302.5L498.0 406.0L444.2 406.0C414.7 406.0 389.9 405.6 389.2 405.2ZM136.5 303.8C136.7 303.6 137.2 288.3 137.6 269.7L138.3 236.0L162.7 236.0L187.0 236.0L187.0 270.0L187.0 304.0L218.5 304.0L250.0 304.0L250.0 235.4L250.0 166.8L207.8 123.9C184.6 100.3 165.1 81.1 164.4 81.2C163.8 81.4 145.1 99.1 122.9 120.6C100.7 142.1 80.8 161.2 78.8 163.0L75.0 166.2L75.0 235.4L75.0 304.5L105.6 304.3C122.4 304.2 136.3 304.0 136.5 303.8ZM965.0 156.5C965.0 139.6 960.2 118.2 953.3 104.0C943.2 83.3 925.1 72.7 902.4 74.4C872.7 76.6 854.4 95.6 847.0 132.2C845.9 137.6 844.7 147.0 844.3 153.0L843.7 164.0L904.3 164.0L965.0 164.0L965.0 156.5Z';

export function Mark({ className = '', title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox={`0 0 ${MARK_W} ${MARK_H}`}
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path fillRule="evenodd" fill="currentColor" d={MARK_D} />
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
export function Logotype({
  className = '',
  title = 'One Interiors',
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg viewBox={`0 0 ${LOGO_W} ${LOGO_H}`} className={className} role="img" aria-label={title}>
      <title>{title}</title>
      <path fillRule="evenodd" fill="currentColor" d={LOGO_D} />
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
