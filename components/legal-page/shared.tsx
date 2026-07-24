const cardShadow = "0 1px 2px rgba(15,107,62,0.04), 0 10px 30px rgba(15,107,62,0.07)"

export function LegalHero({
  title,
  emphasis,
  meta,
  lede,
}: {
  title: string
  emphasis: string
  meta: { label: string; value: string }[]
  lede: string
}) {
  return (
    <div className="max-w-[860px] mx-auto px-6 pt-16 pb-7">
      <span className="inline-block text-xs font-bold tracking-[0.08em] uppercase text-[#0F6B3E] bg-[#EAF7F0] px-3.5 py-1.5 rounded-full">
        Legal Document
      </span>
      <h1
        className="mt-5 mb-[22px] font-extrabold text-[#1E1E1E] leading-[1.12] tracking-[-0.02em]"
        style={{ fontFamily: "'Manrope', sans-serif", fontSize: "clamp(2.375rem, 6vw, 3.5rem)" }}
      >
        {title} <span className="text-[#1FAE5B] italic">{emphasis}</span>
      </h1>
      <div
        className="flex flex-wrap gap-x-7 gap-y-3 px-5 py-[18px] bg-white border border-[#E4E7E5] rounded-[14px] text-[14.5px]"
        style={{ boxShadow: cardShadow }}
      >
        {meta.map(({ label, value }) => (
          <div key={label}>
            <span className="block text-xs uppercase tracking-[0.06em] text-[#7C7C7C] font-semibold mb-0.5">
              {label}
            </span>
            <b className="font-bold text-[#1E1E1E]" style={{ fontFamily: "'Manrope', sans-serif" }}>
              {value}
            </b>
          </div>
        ))}
      </div>
      <p className="mt-[26px] text-[17px] text-[#4B4B4B] leading-[1.65]">{lede}</p>
    </div>
  )
}

export function LegalSection({
  number,
  heading,
  children,
}: {
  number: string
  heading: string
  children: React.ReactNode
}) {
  return (
    <section className="pt-[34px]">
      <span className="block text-xs font-bold tracking-[0.1em] uppercase text-[#1FAE5B]">{number}</span>
      <h2
        className="text-2xl mt-1.5 mb-3.5 font-bold text-[#0F6B3E] leading-tight"
        style={{ fontFamily: "'Manrope', sans-serif" }}
      >
        {heading}
      </h2>
      {children}
    </section>
  )
}

export function LegalP({ children }: { children: React.ReactNode }) {
  return <p className="mb-3.5 text-[15px] text-[#4B4B4B] leading-[1.65]">{children}</p>
}

export function LegalH3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold text-[#1E1E1E] mt-6 mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {children}
    </h3>
  )
}

export function PlainList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-none p-0 m-0 mb-3.5 flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-[15px] text-[#4B4B4B] leading-[1.65]">
          <span className="flex-none w-[7px] h-[7px] rounded-full bg-[#1FAE5B] mt-[9px]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-[22px] mb-1 px-[18px] py-4 border-l-[3px] border-[#1FAE5B] bg-[#EAF7F0] rounded-r-xl text-[14.5px] text-[#4B4B4B] leading-[1.6]">
      {children}
    </div>
  )
}

export function HighlightBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 px-7 py-6 rounded-xl bg-[#1E1E1E]">
      <p className="m-0 text-sm text-white/80 leading-[1.6]">{children}</p>
    </div>
  )
}

export function ContactCard({
  heading,
  rows,
}: {
  heading: string
  rows: { label: string; value: React.ReactNode }[]
}) {
  return (
    <div
      className="bg-white border border-[#E4E7E5] rounded-2xl px-[26px] py-6 mt-2"
      style={{ boxShadow: cardShadow }}
    >
      <h3 className="text-[17px] mb-3.5 font-bold text-[#1E1E1E]" style={{ fontFamily: "'Manrope', sans-serif" }}>
        {heading}
      </h3>
      <ul className="list-none p-0 m-0 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-[14.5px] text-[#4B4B4B]">
        {rows.map(({ label, value }) => (
          <li key={label}>
            <span className="text-[#7C7C7C]">{label}</span>
            <br />
            {value}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DocTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div
      className="overflow-x-auto border border-[#E4E7E5] rounded-2xl bg-white my-1.5"
      style={{ boxShadow: cardShadow }}
    >
      <table className="border-collapse w-full min-w-[520px]">
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="text-left px-[18px] py-3.5 text-sm font-bold text-[#0F6B3E] bg-[#EAF7F0]"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 1 ? "bg-[rgba(31,174,91,0.03)]" : ""}>
              {row.map((cell, j) => (
                <td key={j} className="px-[18px] py-3.5 text-[14.5px] border-t border-[#E4E7E5] align-top text-[#1E1E1E]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ScenarioCard({
  eligible,
  title,
  description,
}: {
  eligible: boolean
  title: string
  description: string
}) {
  return (
    <div className="bg-white border border-[#E4E7E5] rounded-2xl p-5" style={{ boxShadow: cardShadow }}>
      <span
        className={`inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.03em] uppercase mb-2.5 px-2.5 py-1 rounded-full ${
          eligible ? "bg-[#EAF7F0] text-[#178C49]" : "bg-[#FBECEC] text-[#C0392B]"
        }`}
      >
        {eligible ? "✓ Eligible" : "✗ Not eligible"}
      </span>
      <h4 className="text-sm font-bold mb-1.5 text-[#1E1E1E]" style={{ fontFamily: "'Manrope', sans-serif" }}>
        {title}
      </h4>
      <p className="text-[13.5px] m-0 text-[#4B4B4B] leading-[1.55]">{description}</p>
    </div>
  )
}

export function Steps({ steps }: { steps: { number: number; title: string; description: string }[] }) {
  return (
    <div className="flex flex-col gap-3.5 my-5">
      {steps.map((step) => (
        <div key={step.number} className="flex gap-3.5 items-start">
          <div
            className="w-[30px] h-[30px] min-w-[30px] rounded-full bg-[#1FAE5B] text-white flex items-center justify-center text-[13px] font-bold"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            {step.number}
          </div>
          <div>
            <b style={{ fontFamily: "'Manrope', sans-serif" }} className="text-[#1E1E1E]">
              {step.title}.
            </b>{" "}
            <span className="text-[#4B4B4B]">{step.description}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
