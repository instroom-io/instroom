"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MainHeader } from "@/components/shared/main-header"
import { MainFooter } from "@/components/shared/main-footer"
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

const SECTIONS = ["pipeline", "email", "crm", "reporting", "brand-partners"]

const NAV_LINKS: { id: string; label: string }[] = [
  { id: "pipeline", label: "Pipeline" },
  { id: "email", label: "Email" },
  { id: "crm", label: "Creator CRM" },
  { id: "reporting", label: "Reporting" },
  { id: "brand-partners", label: "Brand Partners" },
]

const FEATURE_NAV_ICONS = [
  { key: "discovery", Icon: IconSearch },
  { key: "email", Icon: IconMail },
  { key: "crm", Icon: IconUsers },
  { key: "pipeline", Icon: IconGitBranch },
  { key: "post-tracker", Icon: IconCircleCheck },
  { key: "brand-partners", Icon: IconBuildingStore },
  { key: "reporting", Icon: IconChartBar },
]

function FeatureSidebar({ active }: { active: string }) {
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

export default function FeaturesPage() {
  const [activeSection, setActiveSection] = useState<string>("")

  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".nav")
    const syncHeaderHeight = () => {
      if (header) {
        document.documentElement.style.setProperty("--header-h", `${header.offsetHeight}px`)
      }
    }
    syncHeaderHeight()
    window.addEventListener("resize", syncHeaderHeight)
    return () => window.removeEventListener("resize", syncHeaderHeight)
  }, [])

  useEffect(() => {
    const hash = window.location.hash.replace("#", "")
    if (hash) {
      setTimeout(() => {
        const target = document.getElementById(hash)
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" })
        }
        setActiveSection(hash)
      }, 100)
    }

    // Keep jump nav in sync while scrolling
    const onScroll = () => {
      let current = ""
      SECTIONS.forEach((id) => {
        const el = document.getElementById(id)
        if (el && window.scrollY >= el.offsetTop - 180) current = id
      })
      setActiveSection(current)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div className="bg-white text-[#1E1E1E] font-[Inter,system-ui,-apple-system,sans-serif]">
      {/* Only Tailwind can't do font @imports, so this stays */}
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap");

        @keyframes cardDrag {
          0%{opacity:0;left:3%;top:34%;transform:rotate(0) scale(1);box-shadow:0 2px 6px rgba(0,0,0,.10)}
          6%{opacity:1}
          30%{left:23%;top:20%;transform:translateY(-6px) rotate(-3deg) scale(1.05);box-shadow:0 12px 24px rgba(15,107,62,.28)}
          55%{left:43%;top:14%;transform:translateY(-6px) rotate(-2deg) scale(1.04);box-shadow:0 12px 24px rgba(15,107,62,.28)}
          75%{left:63%;top:38%;transform:rotate(0) scale(1);box-shadow:0 2px 6px rgba(0,0,0,.10)}
          90%{opacity:1;left:63%;top:38%}
          96%{opacity:0;left:63%;top:38%}
          97%{opacity:0;left:3%;top:34%}
          100%{opacity:0}
        }
        @keyframes emailIn {0%{opacity:0;transform:translateY(-16px)}12%{opacity:1;transform:translateY(0)}84%{opacity:1;transform:translateY(0)}95%{opacity:0;transform:translateY(-8px)}100%{opacity:0}}
        @keyframes tagPop {0%,26%{opacity:0;transform:scale(.5)}36%{opacity:1;transform:scale(1.12)}44%,88%{opacity:1;transform:scale(1)}95%,100%{opacity:0}}
        @keyframes dotPulse {0%,100%{opacity:.35}50%{opacity:1}}
        @keyframes tlIn {0%{opacity:0;transform:translateY(7px)}12%{opacity:1;transform:translateY(0)}84%{opacity:1;transform:translateY(0)}96%{opacity:0;transform:translateY(-4px)}100%{opacity:0}}
        @keyframes fillGold {0%,50%{width:0}72%,90%{width:100%}96%,100%{width:0}}
        @keyframes fillSilver {0%,30%{width:0}50%,90%{width:72%}96%,100%{width:0}}
        @keyframes fillBronze {0%,8%{width:0}30%,90%{width:44%}96%,100%{width:0}}
      `}</style>

      {/* NAV */}
      <MainHeader />

      {/* PAGE HERO */}
      <section
        className="pt-24 pb-12 text-center bg-[#F4F7F5]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(31,174,91,0.12) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      >
        <div className="max-w-[1140px] mx-auto px-6">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1FAE5B] mb-4">
            What&apos;s Inside
          </p>
          <h1 className="max-w-[800px] mx-auto mb-5 font-[Manrope,sans-serif] text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-[1.12] tracking-[-0.02em] text-[#1E1E1E]">
            Five tools that replace the stack.
          </h1>
          <p className="max-w-[620px] mx-auto text-lg text-[#52525b] leading-relaxed">
            Pipeline management, embedded email, creator CRM, reporting, and Brand Partners. One
            workspace, built for how you actually run campaigns.
          </p>
        </div>
      </section>

      {/* JUMP NAV */}
      <div
        className="jumpnav sticky z-50 bg-white/95 backdrop-blur-sm border-b border-black/[0.09]"
        style={{ top: "var(--header-h, 65px)" }}
      >
        <div className="flex justify-center items-center gap-1 max-w-[1140px] mx-auto px-6 overflow-x-auto">
          {NAV_LINKS.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className={`text-sm font-medium no-underline px-4 py-3.5 border-b-2 whitespace-nowrap transition-colors ${
                activeSection === link.id
                  ? "text-[#1FAE5B] border-[#1FAE5B]"
                  : "text-[#52525b] border-transparent hover:text-[#1FAE5B] hover:border-[#1FAE5B]"
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>

      {/* FEATURE 1: PIPELINE — white bg, visual on right */}
      <section className="py-24 scroll-mt-[140px] bg-white border-b border-black/[0.07]" id="pipeline">
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="grid grid-cols-1 min-[901px]:grid-cols-2 gap-10 min-[901px]:gap-[72px] items-center">
            <div>
              <p className="flex items-center gap-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-[#1FAE5B] mb-3.5">
                <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-[#1FAE5B]/[0.12] text-[#0F6B3E] text-[0.625rem] font-extrabold shrink-0">
                  01
                </span>
                Pipeline Management
              </p>
              <h2 className="font-[Manrope,sans-serif] text-[clamp(1.625rem,3vw,2.125rem)] font-bold leading-tight text-[#1E1E1E] mb-4">
                Work the way you want. List, board, or both.
              </h2>
              <p className="text-[1.0625rem] font-medium text-[#3f3f46] leading-[1.68] mb-7 text-justify">
                The same data in two views. See everything at a glance in a Kanban board, or scan
                fast in a spreadsheet view. Switch between them in a single click.
              </p>
              <div>
                <p className="text-[#52525b] mb-4 leading-[1.72] text-[0.9375rem] text-justify">
                  Every campaign comes with pre-built pipeline stages: prospect, reached out,
                  negotiating, confirmed, posted, paid. Customize them or use them as-is. No more
                  setting up a new tracker for every campaign.
                </p>
                <p className="text-[#52525b] mb-4 leading-[1.72] text-[0.9375rem] text-justify">
                  The list view feels exactly like the spreadsheet you already love, because it
                  works. The board view gives you the visual read on where things stand. Same
                  data, same updates, two perspectives.
                </p>
                <ul className="list-none p-0 mt-5">
                  {[
                    "Pre-built pipeline stages per campaign type",
                    "Switch between List and Kanban with one click",
                    "Drag and drop creators between stages",
                    "Custom fields for deliverables, fees, deadlines",
                    "Bulk actions: update, assign, or move in one move",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 mb-2.5 text-[#3f3f46] text-[0.9375rem] leading-[1.55]"
                    >
                      <span className="text-[#1FAE5B] font-bold shrink-0 mt-px">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="rounded-[20px] aspect-[4/3] overflow-hidden relative bg-gradient-to-br from-[#EDF5F0] to-[#D4EDDF] border border-[#1FAE5B]/[0.15] shadow-[0_8px_40px_rgba(15,107,62,0.07)]">
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
          </div>
        </div>
      </section>

      {/* FEATURE 2: EMAIL — tinted bg, visual on left */}
      <section className="py-24 scroll-mt-[140px] bg-[#F4F7F5] border-b border-black/[0.07]" id="email">
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="grid grid-cols-1 min-[901px]:grid-cols-2 gap-10 min-[901px]:gap-[72px] items-center">
            <div className="min-[901px]:order-2">
              <p className="flex items-center gap-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-[#1FAE5B] mb-3.5">
                <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-[#1FAE5B]/[0.12] text-[#0F6B3E] text-[0.625rem] font-extrabold shrink-0">
                  02
                </span>
                Embedded Email
              </p>
              <h2 className="font-[Manrope,sans-serif] text-[clamp(1.625rem,3vw,2.125rem)] font-bold leading-tight text-[#1E1E1E] mb-4">
                Reach out, reply, and track without leaving Instroom.
              </h2>
              <p className="text-[1.0625rem] font-medium text-[#3f3f46] leading-[1.68] mb-7 text-justify">
                Your inbox lives inside the workspace. Every email is auto-tagged to the right
                campaign and pipeline stage, so context never gets lost.
              </p>
              <div>
                <p className="text-[#52525b] mb-4 leading-[1.72] text-[0.9375rem] text-justify">
                  When a creator responds at 11pm and your teammate picks it up at 9am, they have
                  the full thread, the campaign, and the creator&apos;s history already loaded. No
                  forwarding. No &quot;wait, which one is this?&quot; No copy-pasting into a
                  spreadsheet after the fact.
                </p>
                <p className="text-[#52525b] mb-4 leading-[1.72] text-[0.9375rem] text-justify">
                  Replies update the pipeline stage automatically. Follow-up reminders live
                  alongside the conversation. Email templates pull creator details so every
                  outreach feels personal without writing every word.
                </p>
                <ul className="list-none p-0 mt-5">
                  {[
                    "Connect Gmail or Outlook in one click",
                    "Every email auto-tagged to campaign and stage",
                    "Personalized templates with creator variables",
                    "Follow-up reminders tied to the conversation",
                    "Full thread history visible on every creator profile",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 mb-2.5 text-[#3f3f46] text-[0.9375rem] leading-[1.55]"
                    >
                      <span className="text-[#1FAE5B] font-bold shrink-0 mt-px">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="min-[901px]:order-1 rounded-[20px] aspect-[4/3] overflow-hidden relative bg-gradient-to-br from-white to-[#F4F7F5] border border-black/[0.09] shadow-[0_8px_40px_rgba(0,0,0,0.05)]">
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
          </div>
        </div>
      </section>

      {/* FEATURE 3: CREATOR CRM — white bg, visual on right */}
      <section className="py-24 scroll-mt-[140px] bg-white border-b border-black/[0.07]" id="crm">
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="grid grid-cols-1 min-[901px]:grid-cols-2 gap-10 min-[901px]:gap-[72px] items-center">
            <div>
              <p className="flex items-center gap-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-[#1FAE5B] mb-3.5">
                <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-[#1FAE5B]/[0.12] text-[#0F6B3E] text-[0.625rem] font-extrabold shrink-0">
                  03
                </span>
                Creator CRM
              </p>
              <h2 className="font-[Manrope,sans-serif] text-[clamp(1.625rem,3vw,2.125rem)] font-bold leading-tight text-[#1E1E1E] mb-4">
                Profiles that remember everything.
              </h2>
              <p className="text-[1.0625rem] font-medium text-[#3f3f46] leading-[1.68] mb-7 text-justify">
                Every campaign, every post, every payment, every conversation. When you come back
                to a creator six months later, the full history is waiting.
              </p>
              <div>
                <p className="text-[#52525b] mb-4 leading-[1.72] text-[0.9375rem] text-justify">
                  Stop rebuilding context every time you reach out. A creator&apos;s profile shows
                  you what you&apos;ve done together, what worked, and what&apos;s next. The
                  conversation from March, the product gifting in June, the post that drove 40
                  sales in September — all in one place.
                </p>
                <p className="text-[#52525b] mb-4 leading-[1.72] text-[0.9375rem] text-justify">
                  Tags, notes, custom fields, and a shared team view mean your whole team sees the
                  same creator the same way. No more &quot;wait, who was handling this
                  relationship?&quot;
                </p>
                <ul className="list-none p-0 mt-5">
                  {[
                    "Full campaign and content history per creator",
                    "Payment and deal history attached to the profile",
                    "Tags, custom fields, and internal notes",
                    "Shared across your team with role-based access",
                    "Quick search across your entire creator database",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 mb-2.5 text-[#3f3f46] text-[0.9375rem] leading-[1.55]"
                    >
                      <span className="text-[#1FAE5B] font-bold shrink-0 mt-px">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="rounded-[20px] aspect-[4/3] overflow-hidden relative bg-gradient-to-br from-[#EDF5F0] to-[#D4EDDF] border border-[#1FAE5B]/[0.15] shadow-[0_8px_40px_rgba(15,107,62,0.07)]">
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
          </div>
        </div>
      </section>

      {/* FEATURE 4: REPORTING — tinted bg, visual on left */}
      <section className="py-24 scroll-mt-[140px] bg-[#F4F7F5] border-b border-black/[0.07]" id="reporting">
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="grid grid-cols-1 min-[901px]:grid-cols-2 gap-10 min-[901px]:gap-[72px] items-center">
            <div className="min-[901px]:order-2">
              <p className="flex items-center gap-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-[#1FAE5B] mb-3.5">
                <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-[#1FAE5B]/[0.12] text-[#0F6B3E] text-[0.625rem] font-extrabold shrink-0">
                  04
                </span>
                Reporting &amp; Analytics
              </p>
              <h2 className="font-[Manrope,sans-serif] text-[clamp(1.625rem,3vw,2.125rem)] font-bold leading-tight text-[#1E1E1E] mb-4">
                Client-ready reports, one click away.
              </h2>
              <p className="text-[1.0625rem] font-medium text-[#3f3f46] leading-[1.68] mb-7 text-justify">
                Stop building reports the night before a client call. Pull performance by creator,
                by campaign, or by deliverable. Export clean PDFs or share a live link.
              </p>
              <div>
                <p className="text-[#52525b] mb-4 leading-[1.72] text-[0.9375rem] text-justify">
                  The data was already in Instroom. Now it&apos;s presentable. Campaign summaries,
                  creator performance breakdowns, spend vs. return, content posted, and engagement
                  metrics — all in a format a client can actually read.
                </p>
                <p className="text-[#52525b] mb-4 leading-[1.72] text-[0.9375rem] text-justify">
                  Share a live link that updates as the campaign progresses, or export a final PDF
                  when everything&apos;s wrapped. Either way, you stop screenshotting and
                  copy-pasting.
                </p>
                <ul className="list-none p-0 mt-5">
                  {[
                    "One-click campaign summary reports",
                    "Per-creator performance breakdowns",
                    "Live-updating shareable links",
                    "Clean PDF exports for final deliverables",
                    "Custom date ranges and filters",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 mb-2.5 text-[#3f3f46] text-[0.9375rem] leading-[1.55]"
                    >
                      <span className="text-[#1FAE5B] font-bold shrink-0 mt-px">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="min-[901px]:order-1 rounded-[20px] aspect-[4/3] overflow-hidden relative bg-gradient-to-br from-white to-[#F4F7F5] border border-black/[0.09] shadow-[0_8px_40px_rgba(0,0,0,0.05)]">
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
          </div>
        </div>
      </section>

      {/* FEATURE 5: BRAND PARTNERS — white bg, visual on right */}
      <section className="py-24 scroll-mt-[140px] bg-white border-b border-black/[0.07]" id="brand-partners">
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="grid grid-cols-1 min-[901px]:grid-cols-2 gap-10 min-[901px]:gap-[72px] items-center">
            <div>
              <p className="flex items-center gap-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-[#1FAE5B] mb-3.5">
                <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-[#1FAE5B]/[0.12] text-[#0F6B3E] text-[0.625rem] font-extrabold shrink-0">
                  05
                </span>
                Brand Partners
              </p>
              <h2 className="font-[Manrope,sans-serif] text-[clamp(1.625rem,3vw,2.125rem)] font-bold leading-tight text-[#1E1E1E] mb-4">
                Creators worth more than a campaign.
              </h2>
              <p className="text-[1.0625rem] font-medium text-[#3f3f46] leading-[1.68] mb-7 text-justify">
                Some creators keep delivering, campaign after campaign. Brand Partners gives those
                relationships structure: tiered status, retainer tracking, and full performance
                history.
              </p>
              <div>
                <p className="text-[#52525b] mb-4 leading-[1.72] text-[0.9375rem] text-justify">
                  Set your revenue thresholds. Instroom assigns Bronze, Silver, and Gold tiers
                  automatically as creators hit milestones. No manual updating, no missed
                  promotions — just a tier list that reflects reality.
                </p>
                <p className="text-[#52525b] mb-4 leading-[1.72] text-[0.9375rem] text-justify">
                  When the budget conversation comes up, the answer is already in the data. You
                  know exactly who&apos;s making you money, who&apos;s consistent, and who
                  deserves a retainer. The best influencer programs aren&apos;t built on
                  campaigns. They&apos;re built on relationships.
                </p>
                <ul className="list-none p-0 mt-5">
                  {["Client workspace access", "Permission levels", "Real-time updates", "White-labeling ready"].map(
                    (item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2.5 mb-2.5 text-[#3f3f46] text-[0.9375rem] leading-[1.55]"
                      >
                        <span className="text-[#1FAE5B] font-bold shrink-0 mt-px">✓</span>
                        {item}
                      </li>
                    )
                  )}
                </ul>
              </div>
            </div>
            <div className="rounded-[20px] aspect-[4/3] overflow-hidden relative bg-gradient-to-br from-[#EDF5F0] to-[#D4EDDF] border border-[#1FAE5B]/[0.15] shadow-[0_8px_40px_rgba(15,107,62,0.07)]">
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
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden bg-[#1E1E1E] text-white text-center py-24">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(31,174,91,0.12) 0%, transparent 70%)",
          }}
        />
        <div className="relative z-10 max-w-[1140px] mx-auto px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-4">Ready to Get Started?</p>
          <h2 className="font-[Manrope,sans-serif] font-bold text-[clamp(2rem,4vw,2.875rem)] text-white max-w-[640px] mx-auto mb-4 leading-tight">
            See it for yourself.
          </h2>
          <p className="text-[1.0625rem] text-white/75 mb-9">
            30 days free. Full platform access. No credit card.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup">
              <Button
                style={{ background: "#fff", color: "#1FAE5B", fontWeight: 700 }}
                className="h-12 px-8 rounded-xl hover:bg-emerald-50"
              >
                Start Free Trial
              </Button>
            </Link>
            <Button
              style={{ background: "transparent", border: "0.5px solid rgba(255,255,255,0.35)", color: "rgba(255,255,255,0.8)" }}
              className="h-12 px-8 rounded-xl hover:bg-white/10 font-medium"
            >
              Book a Demo
            </Button>
          </div>
          <p className="mt-5 text-[0.8125rem] text-white/50">No annual contracts · Cancel anytime</p>
        </div>
      </section>

      <MainFooter />
    </div>
  )
}
