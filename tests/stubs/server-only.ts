/**
 * `server-only`, stubbed for the test runner.
 *
 * The real package exports a module that throws the moment it is imported
 * outside React's `react-server` condition. That is exactly what it is for —
 * it makes a client component importing server code a BUILD failure rather
 * than a runtime leak — and vitest runs in plain Node, where the condition is
 * never set. So any test that reaches a `server-only` module through however
 * many hops dies on import.
 *
 * `tests/scrape.test.ts` did, silently, for long enough that the suite was red
 * and the deploy checklist's `npm run test` gate could not have been passing.
 *
 * ## This does not weaken the boundary
 *
 * Nothing about the real guard depends on the runtime throw in tests. The
 * boundary is enforced two other ways, both still live:
 *
 *   - `next build` fails if a client component imports a `server-only`
 *     module. That is the production guarantee and this stub cannot reach it.
 *   - `tests/server-only-boundary.test.ts` reads the source of every client
 *     component and fails on a VALUE import from a `server-only` module.
 *     It works on text, so it is unaffected by what this file exports.
 *
 * What the stub buys is the ability to test pure logic that happens to live
 * in a file marked server-only — which is most of the services in `modules/`.
 */
export {};
