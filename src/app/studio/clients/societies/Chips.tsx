import { HEAT_LABEL, HEAT_MIN_REACHED, type Heat, type Priority } from '@/modules/studio-practice/society-rules';

export function PriorityChip({ p, byHand }: { p: Priority; byHand?: boolean }) {
  return (
    <span className={`chip xs soc-p soc-${p.toLowerCase()}`} title={byHand ? 'Set by hand' : 'From possession'}>
      {p}
      {byHand ? ' ✎' : ''}
    </span>
  );
}

export function HeatChip({ h, byHand }: { h: Heat | null; byHand?: boolean }) {
  if (!h) return <span className="chip xs soc-h soc-none" title={`Fewer than ${HEAT_MIN_REACHED} leads reached in 60 days`}>Too early</span>;
  return (
    <span className={`chip xs soc-h soc-${h.toLowerCase()}`} title={byHand ? 'Set by hand' : 'From the last 60 days of calls'}>
      {HEAT_LABEL[h]}
      {byHand ? ' ✎' : ''}
    </span>
  );
}
