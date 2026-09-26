#!/usr/bin/env python3
"""
Renders docs/STUDIO-AGREEMENT.md to PDF, under the One Interiors logotype.

## Why HTML and Chromium rather than ReportLab

The source is Markdown with a lot of inline bold carrying meaning — every
clause that matters is emphasised, and in a contract that emphasis is not
decoration, it is where a reader's eye is meant to land. Rebuilding that in
ReportLab's Platypus means hand-mapping every span. Chromium already reads
the HTML that Markdown produces, and gives real widow/orphan control and
running page numbers for nothing.

## Why two files

The Markdown ends with two internal sections — notes for the CA and notes
for the advocate — that say, candidly, which clauses are one-sided and where
One Interiors is exposed. Those belong in front of a lawyer and nowhere near
a studio. The split is at the "For the CA" heading: everything above it is
the signable contract, everything below is internal.

## The logo

Taken from `src/components/brand.tsx` rather than redrawn, so the PDF cannot
drift from the product. LOGO_D is the stacked artwork — the one the component
documents as being for "the head of a quotation PDF", which is this.
"""

import html as htmllib
import pathlib
import re
import subprocess
import sys

import markdown

REPO = pathlib.Path("/sessions/wonderful-laughing-albattani/mnt/OneInteriors")
SRC = REPO / "docs" / "STUDIO-AGREEMENT.md"
OUT = REPO / "docs"
BRAND = REPO / "src" / "components" / "brand.tsx"

# Where the signable contract stops and the internal notes begin.
SPLIT = "## For the CA, before the advocate"


def logo() -> tuple[str, int, int]:
    """The stacked logotype path, straight out of the component."""
    s = BRAND.read_text(encoding="utf-8")

    def const(name: str) -> str:
        m = re.search(rf"const {name} =\s*\n?\s*'([^']*)'", s)
        if not m:
            m = re.search(rf"const {name} = (\d+);", s)
        if not m:
            sys.exit(f"brand.tsx: could not find {name}")
        return m.group(1)

    return const("LOGO_D"), int(const("LOGO_W")), int(const("LOGO_H"))


LOGO_D, LOGO_W, LOGO_H = logo()

# Palette — the locked marketing tokens, not the studio-surface green. This is
# a document a homeowner-facing brand hands to a partner.
CSS = """
@page {
  size: A4;
  margin: 22mm 20mm 20mm 20mm;
}

:root {
  --ink:   #2C2624;
  --ink2:  #4A423E;
  --ink3:  #6B615C;
  --acc:   #C0613C;
  --line:  #DBD5CB;
  --wash:  #F6F3EE;
}

* { box-sizing: border-box; }

html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

body {
  margin: 0;
  font-family: "Charter", "Bitstream Charter", "Liberation Serif", serif;
  font-size: 10.4pt;
  line-height: 1.58;
  color: var(--ink2);
  text-rendering: geometricPrecision;
}

/* ---- cover ------------------------------------------------------------ */

.cover { page-break-after: always; padding-top: 34mm; }

.cover svg { width: 52mm; height: auto; display: block; color: var(--ink); }

.cover h1 {
  font-size: 27pt;
  line-height: 1.12;
  letter-spacing: -0.015em;
  color: var(--ink);
  font-weight: 400;
  margin: 26mm 0 0;
  max-width: 120mm;
}

.cover .rule { border: 0; border-top: 1px solid var(--line); margin: 9mm 0; }

.eyebrow {
  font-family: "Liberation Mono", "DejaVu Sans Mono", monospace;
  font-size: 7.6pt;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink3);
}

.cover .parties { margin-top: 4mm; font-size: 10.4pt; max-width: 118mm; }
.cover .parties p { margin: 0 0 4.5mm; }
.cover .parties strong { color: var(--ink); }

.cover .foot {
  position: absolute;
  bottom: 0;
  font-size: 8.6pt;
  color: var(--ink3);
  max-width: 120mm;
  line-height: 1.5;
}

/* ---- running head ----------------------------------------------------- */

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  border-bottom: 1px solid var(--line);
  padding-bottom: 2.5mm;
  margin-bottom: 8mm;
}
.head svg { width: 17mm; height: auto; color: var(--ink); align-self: center; }

/* ---- body ------------------------------------------------------------- */

h2 {
  font-size: 13.4pt;
  font-weight: 400;
  letter-spacing: -0.01em;
  color: var(--ink);
  margin: 9mm 0 3.5mm;
  padding-bottom: 1.6mm;
  border-bottom: 1px solid var(--line);
  page-break-after: avoid;
  break-after: avoid;
}

h2:first-of-type { margin-top: 0; }

/* The document's own H1 is redundant — the cover sets the title in display
   size, and a second one at the head of clause 1 reads as a mistake. */
body > h1 { display: none; }

p { margin: 0 0 3.6mm; orphans: 3; widows: 3; }

strong { color: var(--ink); font-weight: 700; }

/* A clause opener — "4.2 ..." — should not be stranded at a page foot. */
p, li { break-inside: avoid-page; }

ul, ol { margin: 0 0 3.6mm; padding-left: 6mm; }
li { margin-bottom: 1.6mm; }

hr { border: 0; border-top: 1px solid var(--line); margin: 7mm 0; }

table { border-collapse: collapse; width: 100%; margin: 0 0 5mm; font-size: 9.6pt; }
th, td { border: 1px solid var(--line); padding: 2mm 2.6mm; text-align: left; vertical-align: top; }
th { background: var(--wash); color: var(--ink); font-weight: 700; }

code {
  font-family: "Liberation Mono", monospace;
  font-size: 9pt;
  background: var(--wash);
  padding: 0.3mm 1mm;
}

/* ---- signature block --------------------------------------------------
   The Markdown sets this as two lines of slash-separated labels, which is
   fine to read and impossible to sign. On paper it needs ruled space. */
.sign { break-inside: avoid-page; margin-top: 6mm; display: flex; gap: 14mm; }
.sign .party { flex: 1; }
.sign .who {
  font-weight: 700; color: var(--ink);
  padding-bottom: 4mm; display: block;
}
.sign .field { margin-bottom: 7mm; }
.sign .line { border-bottom: 1px solid var(--ink3); height: 9mm; }
.sign .field .eyebrow { display: block; padding-top: 1.4mm; }

/* ---- internal edition ------------------------------------------------- */

.internal-tag {
  display: inline-block;
  font-family: "Liberation Mono", monospace;
  font-size: 7.4pt;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #fff;
  background: var(--acc);
  padding: 1.2mm 2.4mm;
}
"""


def svg(cls: str) -> str:
    return (
        f'<svg viewBox="0 0 {LOGO_W} {LOGO_H}" class="{cls}" '
        f'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="One Interiors">'
        f'<path fill-rule="evenodd" fill="currentColor" d="{htmllib.escape(LOGO_D)}"/></svg>'
    )


def render(md_text: str) -> str:
    return markdown.markdown(
        md_text,
        extensions=["tables", "sane_lists", "attr_list"],
    )


def page(title: str, cover: str, body: str) -> str:
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>{htmllib.escape(title)}</title>
<style>{CSS}</style></head>
<body>
{cover}
<div class="head">{svg('')}<span class="eyebrow">{htmllib.escape(title)}</span></div>
{body}
</body></html>"""


def signature_block(body_html: str) -> str:
    """Replace the Markdown's two label lines with something signable."""

    def party(who: str) -> str:
        fields = "".join(
            f'<div class="field"><div class="line"></div>'
            f'<span class="eyebrow">{label}</span></div>'
            for label in ("Name", "Title", "Signature", "Date")
        )
        return f'<div class="party"><span class="who">{who}</span>{fields}</div>'

    block = (
        '<div class="sign">'
        + party("Signed for One Interiors")
        + party("Signed for the Studio")
        + "</div>"
    )

    out = []
    replaced = False
    for line in body_html.split("\n"):
        if "Signed for One Interiors" in line:
            out.append(block)
            replaced = True
            continue
        if "Signed for the Studio" in line:
            continue
        out.append(line)
    if not replaced:
        sys.exit("signature block not found — has the Markdown changed?")
    return "\n".join(out)


def build(name: str, md_text: str, title: str, internal: bool) -> pathlib.Path:
    body_html = render(md_text)

    body_html = signature_block(body_html)

    tag = (
        '<p><span class="internal-tag">Internal — not for circulation</span></p>'
        if internal
        else ""
    )

    # The cover carries the logo, the title and the date only. The parties and
    # the draft warning are set out formally on the first page of the contract
    # itself, and repeating them here would be the same text twice in fifteen
    # centimetres.
    cover = f"""<div class="cover">
  {svg('')}
  <h1>Studio Partner Agreement</h1>
  <hr class="rule">
  <p class="eyebrow">Dated [DATE] &middot; Pune, Maharashtra</p>
  {tag}
  <div class="foot">
    <p>One Interiors &middot; Pune</p>
  </div>
</div>"""

    html_path = pathlib.Path("/tmp") / f"{name}.html"
    html_path.write_text(page(title, cover, body_html), encoding="utf-8")

    pdf_path = OUT / f"{name}.pdf"
    subprocess.run(
        [
            "node",
            "/tmp/topdf.js",
            str(html_path),
            str(pdf_path),
        ],
        check=True,
    )
    return pdf_path


def main() -> None:
    text = SRC.read_text(encoding="utf-8")
    if SPLIT not in text:
        sys.exit(f"Split heading not found: {SPLIT!r}")

    contract, internal_notes = text.split(SPLIT, 1)

    a = build(
        "One-Interiors-Studio-Agreement",
        contract.rstrip().rstrip("-").rstrip(),
        "Studio Partner Agreement",
        internal=False,
    )
    b = build(
        "One-Interiors-Studio-Agreement-internal",
        text,
        "Studio Partner Agreement — internal",
        internal=True,
    )
    for p in (a, b):
        print(p, p.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
