import { GoogleButton } from './GoogleButton';

/**
 * "Continue with Google / Apple / Facebook" — whichever are set up.
 *
 * The server decides which exist (`googleOAuth()`, `appleOAuth()`,
 * `facebookOAuth()` in env.ts) and passes the answer in, so a half-configured
 * provider never shows a button that ends in an error. Plain links to our own
 * start routes: no provider script is loaded until somebody chooses one.
 */
export interface Providers {
  google: boolean;
  apple: boolean;
  facebook: boolean;
}

export function anyProvider(p: Providers): boolean {
  return p.google || p.apple || p.facebook;
}

export function SocialButtons({
  providers,
  next,
  className = '',
}: {
  providers: Providers;
  next?: string | null;
  className?: string;
}) {
  const q = next ? `?next=${encodeURIComponent(next)}` : '';
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {providers.google ? <GoogleButton next={next} className="w-full" /> : null}
      {providers.apple ? (
        /* Apple's guidelines: black, the Apple mark, "Continue with Apple". */
        <a
          href={`/auth/oauth/apple/start${q}`}
          className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-black px-5 py-3 text-[15px] font-medium text-white no-underline hover:bg-[#1f1f1f]"
        >
          <svg aria-hidden="true" width="16" height="19" viewBox="0 0 814 1000" fill="currentColor">
            <path d="M788 341c-6 4-108 62-108 190 0 148 130 200 134 202-1 3-21 72-69 142-43 62-88 124-156 124s-86-40-165-40c-77 0-104 41-167 41s-106-57-156-127C44 791 0 668 0 551c0-187 122-287 242-287 64 0 117 42 157 42 38 0 98-45 171-45 28 0 128 3 194 80zM554 159c30-36 51-86 51-136 0-7-1-14-2-20-49 2-107 33-142 73-27 31-53 81-53 132 0 8 1 15 2 18 3 1 8 1 13 1 44 0 99-29 131-68z" />
          </svg>
          Continue with Apple
        </a>
      ) : null}
      {providers.facebook ? (
        /* Facebook's guidelines: the blue, the "f" mark. */
        <a
          href={`/auth/oauth/facebook/start${q}`}
          className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#1877F2] px-5 py-3 text-[15px] font-medium text-white no-underline hover:bg-[#166fe5]"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
          </svg>
          Continue with Facebook
        </a>
      ) : null}
    </div>
  );
}
