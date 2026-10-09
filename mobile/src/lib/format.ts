/** Dates and rupees as the screens print them, in IST. */

const IST = 'Asia/Kolkata';

export const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: IST }).replace(',', '');

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: IST });

export const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST }).toLowerCase();

/** Indian grouping: 1450000 paise → "₹14,500". */
export function inr(paise: number): string {
  const rupees = Math.round(paise / 100);
  const s = String(rupees);
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `₹${rest ? `${rest},${last3}` : last3}`;
}

export const optionPrice = (extraPaise: number) => (extraPaise > 0 ? `+${inr(extraPaise)}` : 'In quote');
