/**
 * Platform-neutral mark. Two renderings, one look:
 *   - a licensed monochrome SVG, inlined so `currentColor` applies, when one exists
 *   - otherwise the entry's `abbr` set in the interface type
 *
 * Neither ever carries a brand color. Per the Brand Guide, emerald is reserved for an
 * actual verified state — an ecosystem listing is not one, so nothing here is emerald.
 * See public/assets/ecosystem/README.md for why the typographic form is the default.
 */
export function PlatformMark({
  abbr,
  logoSvg,
  size = 44,
  className = "",
}: {
  abbr: string;
  logoSvg?: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size };
  const base =
    "flex shrink-0 items-center justify-center rounded-xl border border-line bg-ink-3 text-muted transition-colors group-hover:border-muted/60 group-hover:text-paper";

  if (logoSvg) {
    return (
      <span
        style={style}
        className={`${base} [&>svg]:h-1/2 [&>svg]:w-1/2 ${className}`}
        aria-hidden
        // Build-time file content from public/assets/ecosystem/, never user input.
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: logoSvg }}
      />
    );
  }

  return (
    <span style={style} className={`${base} ${className}`} aria-hidden>
      <span className="font-mono text-sm font-semibold tracking-tight">{abbr}</span>
    </span>
  );
}
