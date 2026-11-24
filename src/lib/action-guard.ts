import 'server-only';
import { unstable_rethrow } from 'next/navigation';

/**
 * The net under every studio server action (owner, 24 Nov 2026: "protecting
 * the software from crashing").
 *
 * The screens call actions inside a transition, so an action that THROWS —
 * the database blinking, a transaction timing out, a duplicate double-click —
 * did not show "that did not save" on the form: it went to the studio error
 * screen and blanked the page. Wrapped in this, the throw is logged with the
 * action's name and the screen gets the answer it already knows how to show.
 *
 * Next's own control flow (redirect, notFound) is rethrown untouched.
 */
export const SAVE_FAILED = 'That did not save. Nothing was lost; try again in a moment.';

export async function guarded<T>(name: string, fallback: NoInfer<T>, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    unstable_rethrow(error);
    console.error(`[studio] action ${name} failed`, error instanceof Error ? `${error.name}: ${error.message}` : error);
    return fallback;
  }
}
