/**
 * The customer skin (globals.css, `.oi-app`) for a screen built on the older
 * `--color-*` tokens: the block remaps them, so the page itself is unchanged.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="oi-app min-h-dvh">{children}</div>;
}
