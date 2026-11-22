import { projectExpenses } from '@/modules/petty-cash/store';
import { ExpenseList } from '../../payments/petty-cash/PettyUi';

/** The project's petty-cash expenses, on its Payments tab (owner, 21 Nov 2026): who paid, what for, the bill and any flag. */
export async function PettyExpenses({ projectId }: { projectId: string }) {
  const { rows, totalPaise } = await projectExpenses(projectId);
  if (rows.length === 0) return null;
  return (
    <section className="card" aria-label="Site expenses">
      <h2 className="m-0 text-[15px] font-semibold">
        Site expenses (petty cash) · ₹{Math.round(totalPaise / 100).toLocaleString('en-IN')}
      </h2>
      <ExpenseList rows={rows} review={false} />
    </section>
  );
}
