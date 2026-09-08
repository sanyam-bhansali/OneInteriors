import { StyleScene } from '@/components/art/StyleScene';

/**
 * The hero image.
 *
 * **There is no photography in this project yet**, and a stock photo of
 * somebody else's living room on a page that promises verified local work
 * would be the first lie on the site. So this is the same drawn room the quiz
 * uses, at full bleed — honestly a drawing, and made from a real material
 * palette rather than a gradient.
 *
 * When real photography arrives, swap the body of this component for an
 * `<Image>` and nothing else on the page changes. Keep the overlay: the
 * headline sits on top of it and needs the contrast.
 */
export function Hero({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`} aria-hidden="true">
      <StyleScene tag="warm-modern" className="h-full w-full object-cover" />

      {/* Warm scrim. Dark enough for text at the bottom left, clear at the
          top right so the room is still legible as a room. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(38,32,25,0.82) 0%, rgba(38,32,25,0.45) 38%, rgba(38,32,25,0.10) 68%, rgba(38,32,25,0) 100%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to right, rgba(38,32,25,0.55) 0%, rgba(38,32,25,0.15) 45%, rgba(38,32,25,0) 75%)',
        }}
      />
    </div>
  );
}
