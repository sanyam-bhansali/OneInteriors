#!/usr/bin/env python3
"""
Pull the line items out of a studio's filed quotations.

    python3 scripts/read-quotations.py <folder> --bhk-default 2 > lines.json

Reads every .xlsm/.xlsx in the folder, emits the JSON that
`ingestQuotations()` in src/modules/quotation/ingest.ts consumes, and prints a
summary to stderr so ops can see what did not parse.

## Why this is a script and not part of the app

It runs once per studio, when they join. Making the web app able to read
spreadsheets would mean carrying a parser — and its supply chain — into a
product that otherwise never opens one. The mapping and the arithmetic, which
are the parts that can be wrong, live in TypeScript and are tested; this file
only does I/O.

## The format it expects

The workbooks we have seen are laid out as repeated room blocks:

    Kitchen
    S.No. | Product | Work Code | Details | Width(mm) | Height(mm) | Amount
    1     | Base Cabinets | MO-01 | BWP Ply with Laminate | 4450 | 700 | 67160
    ...
          |          |       | Kitchen (Sub-total)       |      |     | 199180

A studio whose sheets look different needs a different adapter, not a change
here. Measured against 991 workbooks: 934 parsed, 57 did not — those are
reported by name rather than skipped quietly, because a studio whose archive
is 6% unreadable should be told before we price anything for them.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl is required:  pip install openpyxl")


# Room-block headings, as studios actually write them, mapped onto the
# canonical rooms in catalogue.ts. Matched on a normalised prefix because the
# archive contains "Kids  Bedroom", "Kids Bedroom ", "Childrens Bedroom".
ROOM_PATTERNS: list[tuple[str, str]] = [
    (r"^kitchen", "KITCHEN"),
    (r"^master\s*bed", "MASTER_BEDROOM"),
    (r"^(kids?|child|bedroom\s*2|second\s*bed)", "SECOND_BEDROOM"),
    (r"^(guest|bedroom\s*3|third\s*bed|daughter|son)", "THIRD_BEDROOM"),
    # A bare "Bedroom" heading is the master in every sheet checked.
    (r"^bed\s*room", "MASTER_BEDROOM"),
    (r"^(living|dining|foyer)", "LIVING_DINING"),
    (r"^(bath|toilet|vanity)", "BATHROOMS"),
    (r"^other\s*services", "WHOLE_HOME"),
]

# Rows that look like lines but are not: totals, headers, payment stages.
NOT_A_LINE = re.compile(
    r"sub\s*-?\s*total|sum\s*-?\s*total|professional fee|discount|total project"
    r"|payment stage|booking advance|deliverable|summary by room|s\.?\s*no",
    re.I,
)


def room_for(text: str) -> str | None:
    key = re.sub(r"\s+", " ", str(text)).strip().lower()
    for pattern, room in ROOM_PATTERNS:
        if re.match(pattern, key):
            return room
    return None


def bhk_from(sheet_text: str, fallback: int) -> int:
    """The configuration, from any "3 BHK" the sheet mentions."""
    found = re.search(r"([1-5])\s*bhk", sheet_text, re.I)
    return int(found.group(1)) if found else fallback


def to_mm(value) -> float | None:
    """Width/height cells hold a number, or prose like '3 Horizontal Tandems'."""
    if isinstance(value, (int, float)) and value > 0:
        return float(value)
    return None


def read_workbook(path: Path, fallback_bhk: int) -> dict | None:
    book = openpyxl.load_workbook(path, data_only=True, read_only=True)
    sheet = book[book.sheetnames[0]]

    lines: list[dict] = []
    room: str | None = None
    everything: list[str] = []

    for raw in sheet.iter_rows(max_col=8, values_only=True):
        cells = ["" if c is None else str(c) for c in raw]
        joined = " ".join(cells).strip()
        if not joined:
            continue
        everything.append(joined)

        # A row with only the first cell filled is a room heading.
        if cells[0] and not any(cells[1:5]):
            found = room_for(cells[0])
            if found:
                room = found
            continue

        if NOT_A_LINE.search(joined):
            continue

        product = cells[1].strip()
        work_code = cells[2].strip()
        if not product or not re.match(r"^(MO|NM)", work_code, re.I):
            continue

        amount = next(
            (c for c in reversed(raw) if isinstance(c, (int, float)) and c > 0), None
        )
        if amount is None:
            continue

        lines.append(
            {
                "quotationId": path.stem,
                "room": room,
                "product": re.sub(r"\s+", " ", product),
                "workCode": work_code,
                # The studio's own words for the material. This is what makes
                # a comparison explicable: two quotes ₹1.25 L apart are
                # usually 18mm BWP against 16mm MDF, and only this column
                # says so.
                "details": re.sub(r"\s+", " ", cells[3].strip())[:120] or None,
                "widthMm": to_mm(raw[4]),
                "heightMm": to_mm(raw[5]),
                # The app works in paise. Doing the conversion here keeps a
                # rupee float from ever reaching the pricing code.
                "amountPaise": int(round(float(amount) * 100)),
            }
        )

    book.close()
    if not lines:
        return None

    return {
        "quotationId": path.stem,
        "bhk": bhk_from(" ".join(everything[:40]), fallback_bhk),
        "dated": None,
        "lines": lines,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path)
    parser.add_argument(
        "--bhk-default",
        type=int,
        default=2,
        help="Used when a sheet does not say. 2 BHK is the archive's commonest.",
    )
    args = parser.parse_args()

    paths = sorted(
        [*args.folder.glob("*.xlsm"), *args.folder.glob("*.xlsx")]
    )

    quotations: list[dict] = []
    unreadable: list[str] = []

    for path in paths:
        if path.name.startswith("~$"):
            continue
        try:
            found = read_workbook(path, args.bhk_default)
        except Exception as error:  # noqa: BLE001 — report, never abort the batch
            unreadable.append(f"{path.name}: {type(error).__name__}")
            continue
        if found is None:
            unreadable.append(f"{path.name}: no priced lines found")
        else:
            quotations.append(found)

    json.dump(quotations, sys.stdout, indent=None)

    total_lines = sum(len(q["lines"]) for q in quotations)
    print(
        f"\nread {len(quotations)} quotations, {total_lines} lines"
        f"  ·  {len(unreadable)} unreadable",
        file=sys.stderr,
    )
    for name in unreadable[:20]:
        print(f"    {name}", file=sys.stderr)
    if len(unreadable) > 20:
        print(f"    … and {len(unreadable) - 20} more", file=sys.stderr)


if __name__ == "__main__":
    main()
