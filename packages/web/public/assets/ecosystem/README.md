# Ecosystem platform marks

Entries in `packages/web/data/ecosystem/*.json` may carry an optional
`logo_svg` pointing at a file in this directory, e.g.
`/assets/ecosystem/voice/retell.svg`.

**Most entries deliberately have no file here.** Third-party logos are the
trademarks of their owners and are not redistributable just because a platform
is technically compatible with AgenID — and this registry lists platforms on
technical grounds, with no relationship implied (see the status definitions in
`packages/web/lib/ecosystem.ts`). Shipping a redrawn or scraped mark for a
company that has not granted permission would be both a legal exposure and,
given AgenID's whole proposition is verifiable provenance, exactly the wrong
signal.

So the default rendering is typographic: the platform's own name set in the
AgenID interface type, with a short monochrome `abbr` tile. That is already the
platform-neutral treatment the design calls for — no brand competes for
attention, everything reads as one infrastructure layer.

## Adding a licensed mark

When a platform supplies its mark under terms that permit this use:

1. Drop the SVG at `public/assets/ecosystem/<category>/<id>.svg`.
2. Strip all `fill`/`stroke` color attributes and set `fill="currentColor"` on
   every path. The monochrome treatment is applied by CSS on the surrounding
   element; a hard-coded fill will render as a colored box and break neutrality.
3. Remove `width`/`height`; keep a square-ish `viewBox`.
4. Add `"logo_svg": "/assets/ecosystem/<category>/<id>.svg"` to that platform's
   JSON entry.

The file is read at build time and inlined into the markup
(`readLogoSvg()` in `lib/ecosystem.ts`) — not referenced as `<img src>` — which
is what makes `currentColor` work. A missing file falls back to the typographic
mark automatically, so a broken path degrades quietly rather than rendering a
hole in the page.
