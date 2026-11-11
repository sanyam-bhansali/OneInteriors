import Link from 'next/link';
import type { MissingPhoto } from '@/modules/items/rules';

/**
 * The lines with no photo (owner, 10 Nov 2026: every line on a One Interiors
 * quotation carries a photo). Shown above the builder; the server refuses
 * Send, Send again and Sales final while it has anything in it
 * (modules/items/server.ts `photoGate`). Updates when the lines are saved.
 */
export function PhotoCheck({ missing, required, canLink }: { missing: MissingPhoto[]; required: boolean; canLink: boolean }) {
  const noItem = missing.filter((m) => !m.item);
  const noPhoto = missing.filter((m) => m.item);
  return (
    <div className="qnote bad hnoteline qphotos" role="alert" data-testid="photo-check">
      <div style={{ minWidth: 0, flex: '1 1 320px' }}>
        <p style={{ fontWeight: 600 }}>
          {missing.length === 1 ? '1 line has no photo' : `${missing.length} lines have no photo`}
          {required ? ', so this quotation cannot be sent or marked final yet.' : '. (Photos are switched to optional for now.)'}
        </p>
        {noItem.length > 0 ? (
          <div className="qphotos-group">
            <p className="sm muted">
              Not matched to a One Interiors item.{' '}
              {canLink ? (
                <>
                  Pick the item for each in{' '}
                  <Link href="/studio/products" className="acc-t" style={{ fontWeight: 600 }}>
                    Product master
                  </Link>
                  .
                </>
              ) : (
                'Ask your studio owner to pick the item for each in Product master.'
              )}
            </p>
            <ul>
              {noItem.map((m) => (
                <li key={m.product}>{m.product}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {noPhoto.length > 0 ? (
          <div className="qphotos-group">
            <p className="sm muted">Matched, but One Interiors has not added the item&apos;s photo yet. Tell your One Interiors contact; it is added once for every studio.</p>
            <ul>
              {noPhoto.map((m) => (
                <li key={m.product}>
                  {m.product} <span className="muted">→ {m.item!.name}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
