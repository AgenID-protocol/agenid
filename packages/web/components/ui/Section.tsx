import { Reveal } from "./Reveal";

/**
 * The one owner of vertical rhythm. Every homepage section used to carry its padding on
 * whichever inner wrapper its author happened to add (py-10 / py-14 / py-16 / py-20), so a
 * rhythm change meant editing every section. Now: py-16 md:py-24, a hairline between
 * sections, and one shell width (max-w-6xl) with the same gutters as the header.
 */
export function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
  first = false,
  center = false,
  className = "",
}: {
  id?: string;
  eyebrow?: string;
  title?: React.ReactNode;
  lede?: React.ReactNode;
  children?: React.ReactNode;
  first?: boolean;
  center?: boolean;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-20 ${first ? "" : "border-t border-line"} ${className}`}>
      <Reveal className={`mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24 lg:px-8 ${center ? "text-center" : ""}`}>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        {title && <h2 className={`section-title ${center ? "mx-auto" : ""} max-w-3xl`}>{title}</h2>}
        {lede && <div className={`mt-4 max-w-[68ch] text-base leading-7 text-paper-dim ${center ? "mx-auto" : ""}`}>{lede}</div>}
        {children && <div className={title || lede ? "mt-10 md:mt-12" : ""}>{children}</div>}
      </Reveal>
    </section>
  );
}
