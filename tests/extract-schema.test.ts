import { describe, it, expect } from 'vitest';
import { checkExtraction } from '@/modules/quotation/extract-schema';

/**
 * The gate between a model reading a PDF and a homeowner being quoted.
 *
 * Everything here is pure, which is the point: the arithmetic that decides a
 * price must be testable without an API key, a network, or a document. A
 * failure in this file is a wrong number in front of a customer, so the cases
 * below are the ones that produce wrong numbers rather than the ones that
 * produce errors.
 *
 * The rule throughout is **discard, never repair**. A guessed correction is a
 * figure nobody can trace back to a document, and a filed rate that cannot be
 * traced is worse than a missing one.
 */

const line = (over: Record<string, unknown> = {}) => ({
  room: 'KITCHEN',
  product: 'Base Cabinets',
  workCode: 'MO-01',
  details: '18mm BWP ply',
  widthMm: 2400,
  heightMm: 720,
  amountRupees: 48_000,
  ...over,
});

const quote = (lines: unknown[], over: Record<string, unknown> = {}) => [
  { reference: 'Q-1', bhk: 3, dated: '2026-04-11', lines, ...over },
];

describe('checkExtraction — shape', () => {
  it('passes a well-formed quotation through', () => {
    const { quotations, issues } = checkExtraction(quote([line()]));
    expect(issues).toEqual([]);
    expect(quotations).toHaveLength(1);
    expect(quotations[0]!.lines).toHaveLength(1);
    expect(quotations[0]!.bhk).toBe(3);
    expect(quotations[0]!.dated).toBe('2026-04-11');
  });

  it('converts rupees to paise at the boundary', () => {
    /* The model is asked for rupees because that is what the document says.
       One conversion, in one place, is one place to get it wrong. */
    const { quotations } = checkExtraction(quote([line({ amountRupees: 48_000 })]));
    expect(quotations[0]!.lines[0]!.amountPaise).toBe(4_800_000);
  });

  it('refuses anything that is not a list', () => {
    expect(checkExtraction(null).quotations).toEqual([]);
    expect(checkExtraction({ lines: [] }).quotations).toEqual([]);
    expect(checkExtraction('[]').issues).toHaveLength(1);
  });

  it('keeps the studio wording exactly as printed', () => {
    /* Normalising here would break `classify`, which matches on the studio's
       own spelling. "Storage- Shoe Rack" must not become "Shoe rack". */
    const { quotations } = checkExtraction(
      quote([line({ product: 'Storage- Foyer/Shoe Rack' })]),
    );
    expect(quotations[0]!.lines[0]!.product).toBe('Storage- Foyer/Shoe Rack');
  });
});

describe('checkExtraction — the amount rules', () => {
  /**
   * The single most damaging failure in the whole feature.
   *
   * Every quotation has subtotals, a grand total, tax and discount rows, and
   * each one looks exactly like a line item to something reading row by row.
   * A grand total admitted as a line does not merely add noise — it lands in
   * a median and drags it further than fifty small errors would.
   */
  it('drops a line too large to be one line, and says so', () => {
    const { quotations, issues } = checkExtraction(
      quote([line(), line({ product: 'TOTAL', amountRupees: 90_00_000 })]),
    );
    expect(quotations[0]!.lines).toHaveLength(1);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.reason).toContain('total');
  });

  /**
   * The case the size cap does not catch, and the reason it exists.
   *
   * A 3 BHK grand total is ₹12–20 lakh, comfortably inside the ₹25 lakh
   * ceiling. So the most damaging row in the document passed every check
   * until a structural one was added: a line that equals the sum of the
   * other lines is arithmetic, not an item.
   *
   * This test found that hole. Reading the file did not.
   */
  it('drops a grand total that sits inside the size cap', () => {
    const { quotations, issues } = checkExtraction(
      quote([
        line({ product: 'Kitchen', amountRupees: 4_00_000 }),
        line({ product: 'Wardrobes', amountRupees: 5_00_000 }),
        line({ product: 'Living', amountRupees: 3_00_000 }),
        line({ product: 'Grand Total', amountRupees: 12_00_000 }),
      ]),
    );
    expect(quotations[0]!.lines.map((l) => l.product)).toEqual([
      'Kitchen',
      'Wardrobes',
      'Living',
    ]);
    expect(issues.some((i) => i.reason.includes('sum of every other line'))).toBe(true);
  });

  it('tolerates a total rounded to a "say" figure', () => {
    const { quotations } = checkExtraction(
      quote([
        line({ product: 'Kitchen', amountRupees: 4_10_000 }),
        line({ product: 'Wardrobes', amountRupees: 5_15_000 }),
        line({ product: 'Living', amountRupees: 2_95_000 }),
        line({ product: 'Say', amountRupees: 12_25_000 }),
      ]),
    );
    expect(quotations[0]!.lines).toHaveLength(3);
  });

  it('leaves two equal lines alone', () => {
    /* With two lines, "one equals the other" is two rooms that cost the
       same. Dropping one would lose a real item. */
    const { quotations } = checkExtraction(
      quote([
        line({ product: 'Bedroom one', amountRupees: 2_00_000 }),
        line({ product: 'Bedroom two', amountRupees: 2_00_000 }),
      ]),
    );
    expect(quotations[0]!.lines).toHaveLength(2);
  });

  it('removes one total, not two', () => {
    /**
     * A document with a subtotal AND a grand total. Removing the grand total
     * leaves the subtotal matching the sum of what remains, so a second pass
     * would take it too — and with it a genuine reading of the section. One
     * pass removes the arithmetic; anything further starts removing the
     * quotation.
     */
    const { quotations } = checkExtraction(
      quote([
        line({ product: 'Kitchen', amountRupees: 3_00_000 }),
        line({ product: 'Wardrobes', amountRupees: 3_00_000 }),
        line({ product: 'Subtotal', amountRupees: 6_00_000 }),
        line({ product: 'Grand Total', amountRupees: 12_00_000 }),
      ]),
    );
    expect(quotations[0]!.lines).toHaveLength(3);
    expect(quotations[0]!.lines.some((l) => l.product === 'Grand Total')).toBe(false);
  });

  it('drops rounding artefacts and blank rows silently', () => {
    /* Silently on purpose: a ₹0 row is a spacer, not a problem worth
       reporting, and an issues list full of them hides the real ones. */
    const { quotations, issues } = checkExtraction(
      quote([line(), line({ amountRupees: 0 }), line({ amountRupees: 12 })]),
    );
    expect(quotations[0]!.lines).toHaveLength(1);
    expect(issues).toEqual([]);
  });

  it('reports a line whose amount could not be read', () => {
    const { quotations, issues } = checkExtraction(
      quote([line(), line({ product: 'Wardrobe', amountRupees: 'about 60k' })]),
    );
    expect(quotations[0]!.lines).toHaveLength(1);
    expect(issues[0]!.reason).toContain('Wardrobe');
  });

  it('never repairs an amount', () => {
    /* Not rounded, not coerced, not halved. If it cannot be believed it is
       dropped, because a corrected figure is one nobody can trace. */
    const { quotations } = checkExtraction(quote([line({ amountRupees: 48_000.49 })]));
    expect(quotations[0]!.lines[0]!.amountPaise).toBe(4_800_049);
  });
});

describe('checkExtraction — dimensions and rooms', () => {
  it('discards a dimension in the wrong unit', () => {
    /* 12 metres of wardrobe is a unit error. Null is honest; 12000 is a
       number that would price a wall that does not exist. */
    const { quotations } = checkExtraction(quote([line({ widthMm: 12_000 })]));
    expect(quotations[0]!.lines[0]!.widthMm).toBeNull();
    expect(quotations[0]!.lines[0]!.heightMm).toBe(720);
  });

  it('discards a nonsensical dimension rather than guessing', () => {
    const { quotations } = checkExtraction(quote([line({ widthMm: -400, heightMm: 0 })]));
    expect(quotations[0]!.lines[0]!.widthMm).toBeNull();
    expect(quotations[0]!.lines[0]!.heightMm).toBeNull();
  });

  it('refuses a room it does not recognise', () => {
    /**
     * The room decides what a line MEANS — "Loft" is a kitchen loft or a
     * bedroom loft depending only on the block it sits under. An invented
     * room would classify a line into the wrong catalogue item, so an
     * unrecognised one becomes null and `classify` falls back to what it can
     * tell from the product alone.
     */
    const { quotations } = checkExtraction(quote([line({ room: 'POOL_HOUSE' })]));
    expect(quotations[0]!.lines[0]!.room).toBeNull();
  });

  it('keeps a room it does recognise', () => {
    const { quotations } = checkExtraction(quote([line({ room: 'MASTER_BEDROOM' })]));
    expect(quotations[0]!.lines[0]!.room).toBe('MASTER_BEDROOM');
  });
});

describe('checkExtraction — whole documents', () => {
  it('reports a document that yielded nothing', () => {
    /* A floor plan or a contract sent among the quotations. The prompt asks
       for an empty lines array rather than an extraction, and ops needs to
       see which document it was. */
    const { quotations, issues } = checkExtraction(quote([]));
    expect(quotations).toEqual([]);
    expect(issues[0]!.reference).toBe('Q-1');
  });

  it('reports a document whose every line was unusable', () => {
    const { quotations, issues } = checkExtraction(
      quote([line({ amountRupees: 90_00_000 }), line({ amountRupees: 80_00_000 })]),
    );
    expect(quotations).toEqual([]);
    /* Two dropped lines and then the document itself. */
    expect(issues.length).toBeGreaterThanOrEqual(3);
  });

  it('assumes 3 BHK when the document does not say, and nothing else', () => {
    /* bhk groups rather than prices, so the commonest flat is the least
       distorting assumption — but it IS an assumption and worth pinning. */
    const { quotations } = checkExtraction(quote([line()], { bhk: null }));
    expect(quotations[0]!.bhk).toBe(3);
  });

  it('refuses a malformed date rather than inventing one', () => {
    /* A rate without a date is a rate nobody can tell is stale. A wrong one
       is worse, so an unparseable date is null. */
    const { quotations } = checkExtraction(quote([line()], { dated: 'April 2026' }));
    expect(quotations[0]!.dated).toBeNull();
  });

  it('falls back to a dash when the model gives no reference', () => {
    const { quotations } = checkExtraction(quote([line()], { reference: '   ' }));
    expect(quotations[0]!.quotationId).toBe('—');
  });
});
