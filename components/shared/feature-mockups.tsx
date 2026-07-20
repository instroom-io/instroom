import Image from "next/image"
import {
  IconSearch,
  IconMail,
  IconUsers,
  IconGitBranch,
  IconCircleCheck,
  IconBuildingStore,
  IconChartBar,
  IconFilter,
  IconRefresh,
} from "@tabler/icons-react"

const FEATURE_NAV_ICONS = [
  { key: "discovery", Icon: IconSearch },
  { key: "email", Icon: IconMail },
  { key: "crm", Icon: IconUsers },
  { key: "pipeline", Icon: IconGitBranch },
  { key: "post-tracker", Icon: IconCircleCheck },
  { key: "brand-partners", Icon: IconBuildingStore },
  { key: "reporting", Icon: IconChartBar },
]

export function FeatureSidebar({ active }: { active: string }) {
  return (
    <div className="w-[54px] shrink-0 bg-[#0F6B3E] flex flex-col items-center pt-2.5 pb-2 gap-2">
      <Image src="/INSTROOM WHITE.png" alt="Instroom" width={36} height={8} className="object-contain mb-1" />
      {FEATURE_NAV_ICONS.map(({ key, Icon }) => (
        <div
          key={key}
          className={`w-7 h-7 rounded-lg flex items-center justify-center ${active === key ? "bg-[#1FAE5B]" : ""}`}
        >
          <Icon size={14} stroke={1.75} className="text-white" />
        </div>
      ))}
    </div>
  )
}

export function PipelineMockup({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[20px] aspect-[4/3] overflow-hidden relative bg-gradient-to-br from-[#EDF5F0] to-[#D4EDDF] border border-[#1FAE5B]/[0.15] shadow-[0_8px_40px_rgba(15,107,62,0.07)] ${className}`}>
      <div className="absolute inset-5 bg-white rounded-[14px] overflow-hidden shadow-[0_4px_18px_rgba(16,24,40,0.08)] flex">
        <FeatureSidebar active="pipeline" />
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#eef1f0]">
            <div className="flex items-center gap-1 h-5 px-1.5 rounded-md border border-[#0F6B3E]/15 text-[8px] text-[#9aa4a0]">
              <IconSearch size={10} stroke={2} />
              Search...
            </div>
            <div className="flex items-center gap-1 h-5 px-1.5 rounded-md border border-[#0F6B3E]/15 text-[8px] text-[#52525b] font-semibold">
              <IconFilter size={10} stroke={2} />
              Filters
            </div>
            <span className="text-[8px] text-[#9aa4a0] font-medium">12 influencers</span>
          </div>
          <div className="relative flex-1 flex items-start gap-1 px-2.5 py-3">
            {[
              {
                title: "For Outreach",
                headerClass: "bg-yellow-400 text-white",
                badgeClass: "bg-white/25 text-white",
                actionType: "flow" as const,
                cards: [{ name: "Alex Rivera", handle: "@alexcreates", loc: "IG · Philippines", stats: "1.0K · 0.4% eng", next: "Contacted", blur: true }],
              },
              {
                title: "Contacted",
                headerClass: "bg-orange-400 text-white",
                badgeClass: "bg-white/25 text-white",
                actionType: "flow" as const,
                cards: [{ name: "Taylor Brooks", handle: "@taylorbrooks", loc: "IG · Netherlands", stats: "2.1K · 1.0% eng", next: "In Conversation", blur: true }],
              },
              {
                title: "In Conversation",
                headerClass: "bg-blue-400 text-white",
                badgeClass: "bg-white/25 text-white",
                actionType: "flow" as const,
                cards: [{ name: "Devon Cruz", handle: "@devoncruz", loc: "IG · —", stats: "3 · 0.0% eng", next: "Deal Agreed", blur: true }],
              },
              {
                title: "Deal Agreed",
                headerClass: "bg-green-500 text-white",
                badgeClass: "bg-white/25 text-white",
                actionType: "dealAgreed" as const,
                cards: [
                  { name: "Jordan Lee", handle: "@jordanleeco", loc: "IG · Philippines", stats: "1.8K · 2.7% eng", blur: true },
                  { name: "Sharon Wells", handle: "@liefssharon", loc: "IG · Netherlands", stats: "3.0K · 0.0% eng", blur: false },
                ],
              },
              {
                title: "Not Interested",
                headerClass: "bg-red-100 text-red-700 border border-red-200",
                badgeClass: "bg-red-200 text-red-700",
                actionType: "notInterested" as const,
                cards: [
                  { name: "Suzanne K.", handle: "@suzannek", loc: "IG · —", stats: "1 · 0.0% eng", reason: "Fully booked", blur: true },
                ],
              },
            ].map((col) => (
              <div key={col.title} className="flex-1 min-w-0 flex flex-col gap-1">
                <div className={`rounded-[5px] px-1.5 py-1 text-[7px] font-bold flex items-center justify-between gap-1 ${col.headerClass}`}>
                  <span className="truncate">{col.title}</span>
                  <span className={`rounded-full px-1 py-px text-[6.5px] shrink-0 ${col.badgeClass}`}>{col.cards.length}</span>
                </div>
                {col.cards.map((card, i) => (
                  <div key={i} className="bg-white border border-[#eef1f0] rounded-lg p-1.5 flex flex-col gap-[2px]">
                    <div
                      className="text-[7.5px] font-semibold text-[#1E1E1E] truncate"
                      style={card.blur ? { filter: "blur(2px)" } : undefined}
                    >
                      {card.name}
                    </div>
                    <div
                      className="text-[6.5px] text-[#9aa4a0] truncate"
                      style={card.blur ? { filter: "blur(2px)" } : undefined}
                    >
                      {card.handle}
                    </div>
                    <div className="text-[6px] text-[#9aa4a0] truncate">{card.loc}</div>
                    <div className="text-[6px] text-[#9aa4a0] truncate">{card.stats}</div>
                    {col.actionType === "flow" && (
                      <div className="flex items-center gap-1 mt-px">
                        <span className="text-[5.5px] font-semibold text-[#0F6B3E] bg-green-50 border border-green-200 rounded px-1 py-px truncate">
                          → {"next" in card ? card.next : ""}
                        </span>
                        <span className="text-[5.5px] font-semibold text-red-500 bg-red-50 border border-red-100 rounded px-1 py-px">✕</span>
                      </div>
                    )}
                    {col.actionType === "dealAgreed" && (
                      <div className="text-[5.5px] font-semibold text-white bg-[#1FAE5B] rounded px-1 py-[2px] text-center mt-px truncate">
                        Move to Post Tracker
                      </div>
                    )}
                    {col.actionType === "notInterested" && (
                      <div className="text-[5.5px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded px-1 py-px mt-px truncate">
                        {"reason" in card ? card.reason : ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
            <div
              className="absolute p-1.5 rounded-lg bg-white border-[1.5px] border-[#1FAE5B] flex flex-col gap-[2px]"
              style={{ width: "17%", animation: "cardDrag 6s cubic-bezier(.22,1,.36,1) infinite" }}
            >
              <div className="text-[7.5px] font-semibold text-[#1E1E1E] truncate">Sharon Wells</div>
              <div className="text-[6.5px] text-[#9aa4a0] truncate">@liefssharon</div>
              <div className="text-[6px] text-[#9aa4a0] truncate">IG · Netherlands</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function EmailMockup({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[20px] aspect-[4/3] overflow-hidden relative bg-gradient-to-br from-white to-[#F4F7F5] border border-black/[0.09] shadow-[0_8px_40px_rgba(0,0,0,0.05)] ${className}`}>
      <div className="absolute inset-5 bg-white rounded-[14px] overflow-hidden shadow-[0_4px_18px_rgba(16,24,40,0.08)] flex">
        <FeatureSidebar active="email" />
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-[#eef1f0]">
            <span className="text-[7px] font-bold px-1.5 py-[3px] rounded-full bg-[#1E1E1E] text-white shrink-0">42 All</span>
            {[
              { label: "Prospects", count: 8, cls: "bg-gray-100 text-gray-700" },
              { label: "Reached Out", count: 12, cls: "bg-blue-100 text-blue-700" },
              { label: "In Conversation", count: 6, cls: "bg-purple-100 text-purple-700" },
              { label: "Onboarded", count: 4, cls: "bg-indigo-100 text-indigo-700" },
              { label: "For Order", count: 3, cls: "bg-orange-100 text-orange-700" },
              { label: "In-Transit", count: 2, cls: "bg-yellow-100 text-yellow-700" },
              { label: "Delivered", count: 5, cls: "bg-teal-100 text-teal-700" },
              { label: "Posted", count: 1, cls: "bg-pink-100 text-pink-700" },
              { label: "Completed", count: 9, cls: "bg-green-100 text-green-700" },
              { label: "Rejected", count: 2, cls: "bg-red-100 text-red-700" },
            ].map((s) => (
              <span
                key={s.label}
                className={`text-[7px] font-bold px-1.5 py-[3px] rounded-full truncate max-w-[62px] shrink-0 ${s.cls}`}
              >
                {s.count} {s.label}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#eef1f0]">
            <div>
              <div className="text-[9px] font-bold text-[#1E1E1E]">All Messages</div>
              <div className="flex items-center gap-1 mt-px">
                <span className="w-1 h-1 rounded-full bg-[#1FAE5B] shrink-0" />
                <span className="text-[6.5px] text-[#9aa4a0]">Gmail</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <IconRefresh size={11} stroke={2} className="text-[#9aa4a0]" />
              <span className="w-5 h-5 rounded-md bg-[#1FAE5B] flex items-center justify-center shrink-0">
                <IconMail size={10} stroke={2} className="text-white" />
              </span>
            </div>
          </div>
          <div className="px-3 pt-2">
            <div className="flex items-center gap-1 h-5 px-1.5 rounded-md border border-[#0F6B3E]/15 text-[7px] text-[#9aa4a0]">
              <IconSearch size={9} stroke={2} />
              Search conversations...
            </div>
          </div>
          <div className="p-2.5">
            <div
              className="flex items-center gap-2 p-2.5 rounded-[9px] bg-[#f0faf5] border border-[#c8f0db] mb-[7px]"
              style={{ animation: "emailIn 5s cubic-bezier(.22,1,.36,1) infinite" }}
            >
              <span
                className="w-[26px] h-[26px] rounded-full shrink-0 flex items-center justify-center text-white text-[8px] font-bold"
                style={{ background: "linear-gradient(135deg,#22c55e,#0F6B3E)" }}
              >
                AR
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-[3px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1FAE5B] shrink-0" style={{ animation: "dotPulse 1.4s ease-in-out infinite" }} />
                  <span className="text-[9px] font-semibold text-[#1E1E1E] truncate" style={{ filter: "blur(2px)" }}>Alex Rivera</span>
                </div>
                <span className="block text-[8px] text-[#9aa4a0] truncate">Loved the brief — sending drafts Friday</span>
              </div>
              <span
                className="text-[8px] font-extrabold text-[#0F6B3E] bg-[#d9f5e6] border border-[#c8f0db] px-1.5 py-[2px] rounded-full whitespace-nowrap shrink-0"
                style={{ animation: "tagPop 5s ease-in-out infinite" }}
              >
                Negotiating
              </span>
            </div>
            {[
              { init: "TB", name: "Taylor Brooks", subj: "Following up on the collab rate" },
              { init: "DC", name: "Devon Cruz", subj: "Can we push the posting date?" },
            ].map((row, i) => (
              <div key={i} className={`flex items-center gap-2 p-2.5 ${i < 1 ? "mb-[7px]" : ""}`}>
                <span className="w-[26px] h-[26px] rounded-full bg-[#e8ecea] shrink-0 flex items-center justify-center text-[#9aa4a0] text-[8px] font-bold">
                  {row.init}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="block text-[9px] font-medium text-[#3f3f46] truncate" style={{ filter: "blur(2px)" }}>{row.name}</span>
                  <span className="block text-[8px] text-[#9aa4a0] truncate">{row.subj}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function CrmMockup({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[20px] aspect-[4/3] overflow-hidden relative bg-gradient-to-br from-[#EDF5F0] to-[#D4EDDF] border border-[#1FAE5B]/[0.15] shadow-[0_8px_40px_rgba(15,107,62,0.07)] ${className}`}>
      <div className="absolute inset-5 bg-white rounded-[14px] overflow-hidden shadow-[0_4px_18px_rgba(16,24,40,0.08)] flex">
        <FeatureSidebar active="crm" />
        <div className="flex-1 min-w-0 p-4 flex flex-col">
          <div className="flex items-center gap-3 pb-3.5 border-b border-[#eef1f0]">
            <span
              className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-white text-[13px] font-bold"
              style={{ background: "linear-gradient(135deg,#22c55e,#0F6B3E)" }}
            >
              SW
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-[#1E1E1E] truncate" style={{ filter: "blur(2px)" }}>
                Sharon Wells
              </div>
              <div className="text-[9px] text-[#9aa4a0] truncate" style={{ filter: "blur(2px)" }}>
                @liefssharon · Instagram
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[15px] font-extrabold text-[#0F6B3E]">128K</div>
              <div className="text-[8px] font-bold text-[#9aa4a0] uppercase tracking-[0.06em]">followers</div>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2.5">
            <span className="text-[6.5px] font-bold px-1.5 py-px rounded-full bg-blue-100 text-blue-700">Agreed</span>
            <span className="text-[6.5px] font-bold px-1.5 py-px rounded-full bg-green-100 text-green-700">Approved</span>
          </div>
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            <span className="text-[6.5px] font-semibold px-1.5 py-[3px] rounded-full bg-[#1FAE5B] text-white">Instagram</span>
            <span className="text-[6.5px] font-semibold px-1.5 py-[3px] rounded-full border border-gray-200 text-gray-600">Send Email</span>
            <span className="text-[6.5px] font-semibold px-1.5 py-[3px] rounded-full border border-gray-200 text-gray-600">Send DM</span>
            <span className="text-[6.5px] font-semibold px-1.5 py-[3px] rounded-full border border-gray-200 text-gray-600">Follow up</span>
          </div>
          <div className="flex items-center gap-2.5 mt-2.5 border-b border-[#eef1f0] pb-1.5">
            {["Basic", "Order", "Attribution", "Post", "Stats", "History"].map((t) => (
              <span
                key={t}
                className={`text-[6.5px] font-semibold pb-1 shrink-0 ${
                  t === "History" ? "text-[#1FAE5B] border-b-2 border-[#1FAE5B]" : "text-[#9aa4a0]"
                }`}
              >
                {t}
              </span>
            ))}
          </div>
          <div className="relative pl-3.5 mt-1.5">
            <span className="absolute left-[3px] top-1 bottom-1 w-0.5 bg-[#eaefec]" />
            {[
              { actor: "Jordan M.", label: "Post approved", tag: "bg-[#dcfce7] text-[#166534]", detail: undefined, d: "Sep", delay: 0 },
              { actor: "Jordan M.", label: "Updated status", tag: "bg-[#fff8e1] text-[#854F0B]", detail: "negotiating → agreed", d: "Jun", delay: 0.4 },
              { actor: "Jordan M.", label: "Note added", tag: "bg-[#f3e8ff] text-[#6b21a8]", detail: undefined, d: "Mar", delay: 0.8 },
            ].map((it, i) => (
              <div
                key={i}
                className="relative py-[6px]"
                style={{ animation: "tlIn 5s ease-in-out infinite", animationDelay: `${it.delay}s` }}
              >
                <span
                  className="absolute -left-3.5 w-2 h-2 rounded-full bg-[#1FAE5B]"
                  style={{ boxShadow: "0 0 0 3px #e5f6ed" }}
                />
                <div className="flex items-center gap-1.5">
                  <span className="text-[7px] font-semibold text-[#3f3f46] shrink-0" style={{ filter: "blur(2px)" }}>
                    {it.actor}
                  </span>
                  <span className={`text-[7px] font-semibold px-1.5 py-px rounded-full truncate ${it.tag}`}>{it.label}</span>
                  <span className="text-[7.5px] font-bold text-[#9aa4a0] ml-auto shrink-0">{it.d}</span>
                </div>
                {it.detail && (
                  <div className="text-[6.5px] text-[#9aa4a0] bg-[#f9fafb] rounded px-1.5 py-px mt-1 inline-block">
                    {it.detail}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ReportingMockup({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[20px] aspect-[4/3] overflow-hidden relative bg-gradient-to-br from-white to-[#F4F7F5] border border-black/[0.09] shadow-[0_8px_40px_rgba(0,0,0,0.05)] ${className}`}>
      <div className="absolute inset-5 bg-white rounded-[14px] overflow-hidden shadow-[0_4px_18px_rgba(16,24,40,0.08)] flex">
        <FeatureSidebar active="reporting" />
        <div className="flex-1 min-w-0 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-[#1E1E1E]">Campaign Summary</span>
            <span className="text-[8px] font-bold text-[#1FAE5B] border border-[#1FAE5B] px-2 py-[3px] rounded-full">Export CSV</span>
          </div>
          <div className="flex gap-2 mb-4">
            <div className="flex-1 border border-[#eef1f0] rounded-lg px-2 py-1.5">
              <div className="text-[7px] text-[#9aa4a0]">Total outreach</div>
              <div className="text-[13px] font-extrabold text-[#1E1E1E]">248</div>
            </div>
            <div className="flex-1 border border-[#eef1f0] rounded-lg px-2 py-1.5">
              <div className="text-[7px] text-[#9aa4a0]">Response rate</div>
              <div className="text-[13px] font-extrabold text-[#1FAE5B]">61%</div>
            </div>
            <div className="flex-1 border border-[#eef1f0] rounded-lg px-2 py-1.5">
              <div className="text-[7px] text-[#9aa4a0]">Closed deals</div>
              <div className="text-[13px] font-extrabold text-[#1E1E1E]">86</div>
            </div>
          </div>
          <div className="flex flex-col gap-3 mt-1">
            {[
              { label: "Reached out", val: "248", color: "#1FAE5B", anim: "fillGold 6s cubic-bezier(.22,1,.36,1) infinite" },
              { label: "Responded", val: "151", color: "#5BC98A", anim: "fillSilver 6s cubic-bezier(.22,1,.36,1) infinite" },
              { label: "Closed", val: "86", color: "#2C8EC4", anim: "fillBronze 6s cubic-bezier(.22,1,.36,1) infinite" },
            ].map((row, i) => (
              <div key={i}>
                <div className="flex justify-between text-[8px] mb-1">
                  <span className="text-[#3f3f46] font-medium">{row.label}</span>
                  <span className="text-[#9aa4a0]">{row.val}</span>
                </div>
                <div className="w-full bg-[#f1f4f2] rounded-full h-1.5 overflow-hidden">
                  <div className="h-full rounded-full" style={{ background: row.color, animation: row.anim }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function BrandPartnersMockup({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[20px] aspect-[4/3] overflow-hidden relative bg-gradient-to-br from-[#EDF5F0] to-[#D4EDDF] border border-[#1FAE5B]/[0.15] shadow-[0_8px_40px_rgba(15,107,62,0.07)] ${className}`}>
      <div className="absolute inset-5 bg-white rounded-[14px] overflow-hidden shadow-[0_4px_18px_rgba(16,24,40,0.08)] flex">
        <FeatureSidebar active="brand-partners" />
        <div className="flex-1 min-w-0 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-[#1E1E1E]">Brand Partners</span>
            <span className="text-[7.5px] text-[#9aa4a0]">18 total · 4 Gold</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {[
              { init: "SW", name: "Sharon Wells", retainer: "$1,200/mo", tier: "🥇 Gold", tierClass: "bg-[#fff8e1] text-[#854F0B]", rev: "$18.4K", delay: 0 },
              { init: "JL", name: "Jordan Lee", retainer: "$600/mo", tier: "🥈 Silver", tierClass: "bg-[#f0f0f0] text-[#444]", rev: "$6.2K", delay: 0.4 },
              { init: "AR", name: "Alex Rivera", retainer: "—", tier: "🥉 Bronze", tierClass: "bg-[#fdf0e8] text-[#7a3e1a]", rev: "$2.1K", delay: 0.8 },
            ].map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-2 border border-[#eef1f0] rounded-lg px-2 py-1.5"
                style={{ animation: "tlIn 5s ease-in-out infinite", animationDelay: `${p.delay}s` }}
              >
                <span
                  className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-white text-[7px] font-bold"
                  style={{ background: "linear-gradient(135deg,#22c55e,#0F6B3E)" }}
                >
                  {p.init}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-semibold text-[#1E1E1E] truncate" style={{ filter: "blur(2px)" }}>
                    {p.name}
                  </div>
                  <div className="text-[7.5px] text-[#9aa4a0] truncate">Retainer {p.retainer}</div>
                </div>
                <span className={`text-[8px] font-bold px-1.5 py-[2px] rounded-full shrink-0 whitespace-nowrap ${p.tierClass}`}>
                  {p.tier}
                </span>
                <span className="text-[9px] font-extrabold text-[#1FAE5B] shrink-0">{p.rev}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
