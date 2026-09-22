/**
 * The result shape every studio form action returns, and its idle value.
 *
 * ## Why this is not in each `actions.ts`
 *
 * It was — eight identical copies of these two lines, one per actions file.
 * That is a Next.js build error, not a style problem:
 *
 *     Error: A "use server" file can only export async functions, found object.
 *
 * Every export from a `'use server'` module is published as a callable
 * endpoint, so a plain object cannot be one. The type was fine (types are
 * erased); `IDLE` was the object. It went unnoticed for a long time because
 * `tsc` and `eslint` both pass on it and the error only surfaces when Next
 * collects page data for a route that imports it — which is to say, at
 * deploy.
 *
 * So the value lives here, in an ordinary module with no directive, and the
 * actions files import the type from it. One definition, and the build error
 * cannot come back by copy-paste.
 */

export type State =
  | { ok: true }
  | { ok: false; error: string }
  /**
   * A refusal the person can overrule.
   *
   * Added for the duplicate-phone check on Add client, where "this number is
   * already on your board" is a question rather than a mistake — two people
   * in one family really do share a number.
   *
   * It carries `error` as well, so every existing `'error' in result` branch
   * keeps working and a form that has not been taught about `askAgain`
   * simply shows the sentence. The forms that HAVE been taught render the
   * override beside it.
   */
  | { ok: false; error: string; askAgain: { label: string; field: string } }
  | { idle: true };

/**
 * The state a form is in before anybody has submitted it.
 *
 * `useActionState` needs an initial value, and `{ idle: true }` is the third
 * arm on purpose: without it, "not submitted yet" and "submitted and failed"
 * are the same shape, and the form shows an error before it has been used.
 */
export const IDLE: State = { idle: true };
