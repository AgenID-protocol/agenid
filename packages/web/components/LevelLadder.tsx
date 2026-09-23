/**
 * The central fact of this deployment, drawn so it reads in three seconds: L1 is the only
 * level agenid.com issues today. L2–L4 are defined in v1.1.1 and need the root authority
 * key; L5 is a reserved name.
 *
 * It describes the PROTOCOL, not an agent, so it uses no trust colour at all — no mint,
 * no amber. State is carried by shape and words: solid = issued here today, outline =
 * defined, dashed = reserved. That survives greyscale printing and colour-vision
 * deficiency, and it cannot be mistaken for a badge.
 *
 * The table beneath it on the page remains the data of record.
 */
const RUNGS = [
  { l: "L5", name: "Continuously Monitored", state: "reserved" as const, note: "reserved name" },
  { l: "L4", name: "Deployment Verified", state: "defined" as const, note: "defined · not issued" },
  { l: "L3", name: "Organization Verified", state: "defined" as const, note: "defined · not issued" },
  { l: "L2", name: "Domain Verified", state: "defined" as const, note: "defined · not issued" },
  { l: "L1", name: "Registered", state: "issued" as const, note: "issued today" },
];

const SHAPE = {
  issued: "border-line-strong bg-paper/[0.06] text-paper",
  defined: "border-line-strong text-paper-dim",
  reserved: "border-dashed border-line text-muted",
};

export function LevelLadder() {
  return (
    <figure
      role="img"
      aria-label="Verification levels L1 to L5. Only L1, Registered, is issued by agenid.com today. L2 to L4 are defined in v1.1.1 but require the root authority key, which has not been generated. L5 is a reserved name."
      className="max-w-xl"
    >
      <div aria-hidden className="flex flex-col gap-2">
        {RUNGS.map((r, i) => (
          <div key={r.l}>
            {r.l === "L1" && (
              <div className="my-3 flex items-center gap-3">
                <div className="h-0.5 flex-1 bg-paper-dim" />
                <div className="shrink-0 text-right text-xs font-medium text-paper-dim">
                  <div>↑ Defined in v1.1.1 · requires the root authority key</div>
                  <div>↓ Issuable on agenid.com today</div>
                </div>
              </div>
            )}
            <div
              className={`flex h-12 items-center justify-between rounded-lg border px-4 ${SHAPE[r.state]}`}
              style={{ marginLeft: `${(4 - i) * 5}%` }}
            >
              <span className="flex items-baseline gap-3">
                <span className="font-mono text-sm font-semibold">{r.l}</span>
                <span className={`text-sm ${r.state === "reserved" ? "italic" : ""}`}>{r.name}</span>
              </span>
              <span className="text-xs">
                {r.state === "issued" && <span className="mr-1">✓</span>}
                {r.note}
              </span>
            </div>
          </div>
        ))}
      </div>
    </figure>
  );
}
