"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MainHeader } from "@/components/shared/main-header"

const SECTIONS = ["pipeline", "email", "crm", "reporting", "brand-partners"]

const NAV_LINKS: { id: string; label: string }[] = [
  { id: "pipeline", label: "Pipeline" },
  { id: "email", label: "Email" },
  { id: "crm", label: "Creator CRM" },
  { id: "reporting", label: "Reporting" },
  { id: "brand-partners", label: "Brand Partners" },
]

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
          0%{opacity:0;left:5%;top:56%;transform:rotate(0) scale(1);box-shadow:0 2px 6px rgba(0,0,0,.10)}
          7%{opacity:1}
          16%{transform:translateY(-9px) rotate(-3deg) scale(1.05);box-shadow:0 16px 30px rgba(15,107,62,.30)}
          46%{left:37%;top:30%;transform:translateY(-6px) rotate(-2deg) scale(1.04);box-shadow:0 16px 30px rgba(15,107,62,.30)}
          58%{left:37%;top:42%;transform:rotate(0) scale(1);box-shadow:0 2px 6px rgba(0,0,0,.10)}
          86%{opacity:1;left:37%;top:42%}
          94%{opacity:0;left:37%;top:42%}
          95%{opacity:0;left:5%;top:56%}
          100%{opacity:0}
        }
        @keyframes emailIn {0%{opacity:0;transform:translateY(-16px)}12%{opacity:1;transform:translateY(0)}84%{opacity:1;transform:translateY(0)}95%{opacity:0;transform:translateY(-8px)}100%{opacity:0}}
        @keyframes tagPop {0%,26%{opacity:0;transform:scale(.5)}36%{opacity:1;transform:scale(1.12)}44%,88%{opacity:1;transform:scale(1)}95%,100%{opacity:0}}
        @keyframes dotPulse {0%,100%{opacity:.35}50%{opacity:1}}
        @keyframes tlIn {0%{opacity:0;transform:translateY(7px)}12%{opacity:1;transform:translateY(0)}84%{opacity:1;transform:translateY(0)}96%{opacity:0;transform:translateY(-4px)}100%{opacity:0}}
        @keyframes barGrow {0%{transform:scaleY(0)}22%{transform:scaleY(1)}80%{transform:scaleY(1)}100%{transform:scaleY(0)}}
        @keyframes climb {0%{opacity:0;top:72%}8%{opacity:1}30%{top:72%}50%{top:44%}72%{top:16%}90%{opacity:1;top:16%}96%{opacity:0;top:16%}100%{opacity:0;top:72%}}
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
              <p className="text-[1.0625rem] font-medium text-[#3f3f46] leading-[1.68] mb-7">
                The same data in two views. See everything at a glance in a Kanban board, or scan
                fast in a spreadsheet view. Switch between them in a single click.
              </p>
              <div>
                <p className="text-[#52525b] mb-4 leading-[1.72] text-[0.9375rem]">
                  Every campaign comes with pre-built pipeline stages: prospect, reached out,
                  negotiating, confirmed, posted, paid. Customize them or use them as-is. No more
                  setting up a new tracker for every campaign.
                </p>
                <p className="text-[#52525b] mb-4 leading-[1.72] text-[0.9375rem]">
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
              <div className="absolute inset-5 bg-white rounded-[14px] overflow-hidden shadow-[0_4px_18px_rgba(16,24,40,0.08)]">
                <div className="flex items-center gap-2 px-3.5 py-3 border-b border-[#eef1f0]">
                  <span className="w-2 h-2 rounded-full bg-[#e3e7e5]" />
                  <span className="w-2 h-2 rounded-full bg-[#e3e7e5]" />
                  <span className="w-2 h-2 rounded-full bg-[#e3e7e5]" />
                  <div className="ml-2 flex bg-[#f1f4f2] rounded-full p-[3px]">
                    <span className="text-[10px] font-bold text-[#9aa4a0] px-2.5 py-[3px] rounded-full">List</span>
                    <span className="text-[10px] font-bold text-white px-2.5 py-[3px] rounded-full bg-[#1FAE5B]">Board</span>
                  </div>
                </div>
                <div className="absolute left-0 right-0 bottom-0 flex gap-[2%] px-[4%] py-3.5" style={{ top: "47px" }}>
                  <div className="flex-1 bg-[#f7faf8] rounded-[10px] p-2">
                    <div className="h-1.5 w-[60%] bg-[#c8d4ce] rounded mb-2" />
                    <div className="h-[34px] bg-white border border-[#eef1f0] rounded-lg mb-1.5" />
                    <div className="h-[34px] bg-white border border-[#eef1f0] rounded-lg" />
                  </div>
                  <div className="flex-1 bg-[#f7faf8] rounded-[10px] p-2">
                    <div className="h-1.5 w-[70%] bg-[#c8d4ce] rounded mb-2" />
                    <div className="h-[34px] bg-white border border-[#eef1f0] rounded-lg" />
                  </div>
                  <div className="flex-1 bg-[#f7faf8] rounded-[10px] p-2">
                    <div className="h-1.5 w-[55%] bg-[#c8d4ce] rounded mb-2" />
                    <div className="h-[34px] bg-white border border-[#eef1f0] rounded-lg" />
                  </div>
                </div>
                <div
                  className="absolute p-2 rounded-lg bg-white border-[1.5px] border-[#1FAE5B]"
                  style={{ width: "26%", animation: "cardDrag 5.5s cubic-bezier(.22,1,.36,1) infinite" }}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="w-4 h-4 rounded-full" style={{ background: "linear-gradient(135deg,#22c55e,#0F6B3E)" }} />
                    <span className="h-[5px] w-[60%] bg-[#d5dbd8] rounded" />
                  </div>
                  <span className="inline-block h-[5px] w-[40%] bg-[#eaeeec] rounded" />
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
              <p className="text-[1.0625rem] font-medium text-[#3f3f46] leading-[1.68] mb-7">
                Your inbox lives inside the workspace. Every email is auto-tagged to the right
                campaign and pipeline stage, so context never gets lost.
              </p>
              <div>
                <p className="text-[#52525b] mb-4 leading-[1.72] text-[0.9375rem]">
                  When a creator responds at 11pm and your teammate picks it up at 9am, they have
                  the full thread, the campaign, and the creator&apos;s history already loaded. No
                  forwarding. No &quot;wait, which one is this?&quot; No copy-pasting into a
                  spreadsheet after the fact.
                </p>
                <p className="text-[#52525b] mb-4 leading-[1.72] text-[0.9375rem]">
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
              <div className="absolute inset-5 bg-white rounded-[14px] overflow-hidden shadow-[0_4px_18px_rgba(16,24,40,0.08)]">
                <div className="flex items-center gap-2 px-3.5 py-3 border-b border-[#eef1f0]">
                  <span className="w-2 h-2 rounded-full bg-[#e3e7e5]" />
                  <span className="w-2 h-2 rounded-full bg-[#e3e7e5]" />
                  <span className="ml-1.5 text-[10px] font-bold text-[#9aa4a0] uppercase tracking-[0.08em]">Inbox</span>
                </div>
                <div className="p-2.5">
                  <div
                    className="flex items-center gap-2 p-2.5 rounded-[9px] bg-[#f0faf5] border border-[#c8f0db] mb-[7px]"
                    style={{ animation: "emailIn 5s cubic-bezier(.22,1,.36,1) infinite" }}
                  >
                    <span className="w-[26px] h-[26px] rounded-full shrink-0" style={{ background: "linear-gradient(135deg,#22c55e,#0F6B3E)" }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-[5px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1FAE5B]" style={{ animation: "dotPulse 1.4s ease-in-out infinite" }} />
                        <span className="h-1.5 w-[42%] rounded" style={{ background: "#0F6B3E", opacity: 0.55 }} />
                      </div>
                      <span className="inline-block h-[5px] w-[70%] bg-[#c3d6cc] rounded" />
                    </div>
                    <span
                      className="text-[9px] font-extrabold text-[#0F6B3E] bg-[#d9f5e6] border border-[#c8f0db] px-2 py-[3px] rounded-full whitespace-nowrap"
                      style={{ animation: "tagPop 5s ease-in-out infinite" }}
                    >
                      Negotiating
                    </span>
                  </div>
                  {[38, 46, 32].map((w, i) => (
                    <div key={i} className={`flex items-center gap-2 p-2.5 ${i < 2 ? "mb-[7px]" : ""}`}>
                      <span className="w-[26px] h-[26px] rounded-full bg-[#e8ecea] shrink-0" />
                      <div className="flex-1">
                        <div className="h-1.5 bg-[#d5dbd8] rounded mb-[5px]" style={{ width: `${w}%` }} />
                        <span className="inline-block h-[5px] w-[60%] bg-[#eaeeec] rounded" />
                      </div>
                    </div>
                  ))}
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
              <p className="text-[1.0625rem] font-medium text-[#3f3f46] leading-[1.68] mb-7">
                Every campaign, every post, every payment, every conversation. When you come back
                to a creator six months later, the full history is waiting.
              </p>
              <div>
                <p className="text-[#52525b] mb-4 leading-[1.72] text-[0.9375rem]">
                  Stop rebuilding context every time you reach out. A creator&apos;s profile shows
                  you what you&apos;ve done together, what worked, and what&apos;s next. The
                  conversation from March, the product gifting in June, the post that drove 40
                  sales in September — all in one place.
                </p>
                <p className="text-[#52525b] mb-4 leading-[1.72] text-[0.9375rem]">
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
              <div className="absolute inset-5 bg-white rounded-[14px] overflow-hidden shadow-[0_4px_18px_rgba(16,24,40,0.08)] p-4">
                <div className="flex items-center gap-3 pb-3.5 border-b border-[#eef1f0]">
                  <span className="w-11 h-11 rounded-full shrink-0" style={{ background: "linear-gradient(135deg,#22c55e,#0F6B3E)" }} />
                  <div className="flex-1">
                    <div className="h-2 w-[44%] rounded mb-[7px]" style={{ background: "#1E1E1E", opacity: 0.8 }} />
                    <div className="h-1.5 w-[30%] bg-[#c3d6cc] rounded" />
                  </div>
                  <div className="text-right">
                    <div className="text-[15px] font-extrabold text-[#0F6B3E]">128K</div>
                    <div className="text-[8px] font-bold text-[#9aa4a0] uppercase tracking-[0.06em]">followers</div>
                  </div>
                </div>
                <div className="text-[9px] font-bold text-[#9aa4a0] uppercase tracking-[0.08em] mt-3 mb-1">History</div>
                <div className="relative pl-3.5">
                  <span className="absolute left-[3px] top-1 bottom-1 w-0.5 bg-[#eaefec]" />
                  {[
                    { w: 64, d: "Sep", delay: 0, active: true },
                    { w: 52, d: "Jun", delay: 0.4, active: true },
                    { w: 70, d: "Mar", delay: 0.8, active: true },
                    { w: 46, d: "Jan", delay: 1.2, active: false },
                  ].map((it, i) => (
                    <div
                      key={i}
                      className="relative flex items-center gap-2 py-[7px]"
                      style={{ animation: "tlIn 5s ease-in-out infinite", animationDelay: `${it.delay}s` }}
                    >
                      <span
                        className="absolute -left-3.5 w-2 h-2 rounded-full"
                        style={{ background: it.active ? "#1FAE5B" : "#c3d6cc", boxShadow: `0 0 0 3px ${it.active ? "#e5f6ed" : "#eef4f1"}` }}
                      />
                      <div className="flex-1">
                        <div className="h-1.5 rounded" style={{ width: `${it.w}%`, background: it.active ? "#d5dbd8" : "#e2e7e5" }} />
                      </div>
                      <span className="text-[9px] font-bold" style={{ color: it.active ? "#9aa4a0" : "#c3ccc8" }}>{it.d}</span>
                    </div>
                  ))}
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
              <p className="text-[1.0625rem] font-medium text-[#3f3f46] leading-[1.68] mb-7">
                Stop building reports the night before a client call. Pull performance by creator,
                by campaign, or by deliverable. Export clean PDFs or share a live link.
              </p>
              <div>
                <p className="text-[#52525b] mb-4 leading-[1.72] text-[0.9375rem]">
                  The data was already in Instroom. Now it&apos;s presentable. Campaign summaries,
                  creator performance breakdowns, spend vs. return, content posted, and engagement
                  metrics — all in a format a client can actually read.
                </p>
                <p className="text-[#52525b] mb-4 leading-[1.72] text-[0.9375rem]">
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
              <div className="absolute inset-5 bg-white rounded-[14px] overflow-hidden shadow-[0_4px_18px_rgba(16,24,40,0.08)] p-4">
                <div className="flex items-center justify-between mb-3.5">
                  <div className="h-[7px] w-[38%] bg-[#d5dbd8] rounded" />
                  <span className="text-[9px] font-extrabold text-white px-2.5 py-1 rounded-full" style={{ background: "linear-gradient(135deg,#22c55e,#0F6B3E)" }}>Export PDF</span>
                </div>
                <div className="flex gap-3.5 mb-4">
                  <div><div className="text-base font-extrabold text-[#0F6B3E]">$48.2K</div><div className="text-[8px] font-bold text-[#9aa4a0] uppercase tracking-[0.06em]">Return</div></div>
                  <div><div className="text-base font-extrabold text-[#1E1E1E]">3.4M</div><div className="text-[8px] font-bold text-[#9aa4a0] uppercase tracking-[0.06em]">Reach</div></div>
                  <div><div className="text-base font-extrabold text-[#1E1E1E]">6.1%</div><div className="text-[8px] font-bold text-[#9aa4a0] uppercase tracking-[0.06em]">Eng.</div></div>
                </div>
                <div className="absolute left-4 right-4 bottom-4 flex items-end gap-[8%] border-b border-[#eef1f0]" style={{ height: "38%" }}>
                  {[
                    { h: 52, d: 0, dark: false },
                    { h: 74, d: 0.12, dark: false },
                    { h: 46, d: 0.24, dark: false },
                    { h: 88, d: 0.36, dark: true },
                    { h: 64, d: 0.48, dark: false },
                    { h: 96, d: 0.6, dark: true },
                  ].map((b, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-[5px]"
                      style={{
                        height: `${b.h}%`,
                        transformOrigin: "bottom",
                        background: b.dark ? "linear-gradient(#39c46f,#0F6B3E)" : "linear-gradient(#39c46f,#1FAE5B)",
                        animation: "barGrow 4.5s cubic-bezier(.22,1,.36,1) infinite",
                        animationDelay: `${b.d}s`,
                      }}
                    />
                  ))}
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
              <p className="text-[1.0625rem] font-medium text-[#3f3f46] leading-[1.68] mb-7">
                Some creators keep delivering, campaign after campaign. Brand Partners gives those
                relationships structure: tiered status, retainer tracking, and full performance
                history.
              </p>
              <div>
                <p className="text-[#52525b] mb-4 leading-[1.72] text-[0.9375rem]">
                  Set your revenue thresholds. Instroom assigns Bronze, Silver, and Gold tiers
                  automatically as creators hit milestones. No manual updating, no missed
                  promotions — just a tier list that reflects reality.
                </p>
                <p className="text-[#52525b] mb-4 leading-[1.72] text-[0.9375rem]">
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
              <div className="absolute inset-5 bg-white rounded-[14px] overflow-hidden shadow-[0_4px_18px_rgba(16,24,40,0.08)] p-[18px]">
                <div className="text-[9px] font-bold text-[#9aa4a0] uppercase tracking-[0.08em] mb-3">Partner tiers</div>
                <div className="relative">
                  <div className="flex items-center gap-2.5 mb-3.5">
                    <span className="w-[30px] h-[30px] rounded-full shrink-0" style={{ background: "linear-gradient(135deg,#F4C24A,#D99A17)" }} />
                    <div className="flex-1">
                      <div className="text-[11px] font-extrabold text-[#1E1E1E] mb-[5px]">Gold</div>
                      <div className="h-[7px] bg-[#f1f4f2] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#F4C24A,#D99A17)", animation: "fillGold 6s cubic-bezier(.22,1,.36,1) infinite" }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 mb-3.5">
                    <span className="w-[30px] h-[30px] rounded-full shrink-0" style={{ background: "linear-gradient(135deg,#D6DBDE,#9AA3AA)" }} />
                    <div className="flex-1">
                      <div className="text-[11px] font-extrabold text-[#1E1E1E] mb-[5px]">Silver</div>
                      <div className="h-[7px] bg-[#f1f4f2] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#D6DBDE,#9AA3AA)", animation: "fillSilver 6s cubic-bezier(.22,1,.36,1) infinite" }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-[30px] h-[30px] rounded-full shrink-0" style={{ background: "linear-gradient(135deg,#D89B6A,#A9663B)" }} />
                    <div className="flex-1">
                      <div className="text-[11px] font-extrabold text-[#1E1E1E] mb-[5px]">Bronze</div>
                      <div className="h-[7px] bg-[#f1f4f2] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#D89B6A,#A9663B)", animation: "fillBronze 6s cubic-bezier(.22,1,.36,1) infinite" }} />
                      </div>
                    </div>
                  </div>
                  <div
                    className="absolute right-0 w-[34px] h-[34px] -mt-0.5 rounded-full border-[2.5px] border-white"
                    style={{ background: "linear-gradient(135deg,#22c55e,#0F6B3E)", boxShadow: "0 6px 16px rgba(15,107,62,.35)", animation: "climb 6s cubic-bezier(.22,1,.36,1) infinite" }}
                  />
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
          <h2 className="font-[Manrope,sans-serif] font-bold text-[clamp(2rem,4vw,2.875rem)] text-white max-w-[640px] mx-auto mb-4 leading-tight">
            See it for yourself.
          </h2>
          <p className="text-[1.0625rem] text-white/75 mb-9">
            30 days free. Full platform access. No credit card.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup">
              <Button className="bg-gradient-to-r from-[#1FAE5B] to-[#28c96a] text-white font-semibold h-12 px-8 rounded-xl hover:from-[#158a48] hover:to-[#1FAE5B] shadow-lg shadow-emerald-500/30">
                Start Free Trial
              </Button>
            </Link>
          </div>
          <p className="mt-5 text-[0.8125rem] text-white/50">No annual contracts · Cancel anytime</p>
        </div>
      </section>

      {/* FOOTER — matches landing page */}
      <footer className="bg-[#111] text-white/65 pt-14 pb-8 text-sm">
        <div className="grid grid-cols-1 min-[641px]:grid-cols-2 min-[901px]:grid-cols-[2fr_1fr_1fr_1fr] gap-10 mb-10 max-w-[1140px] mx-auto px-6">
          <div>
            <Image
              src="/images/instroomLogoWhite.png"
              alt="Instroom logo"
              width={120}
              height={120}
              style={{ marginBottom: "4px" }}
            />
            <p className="text-white/55 max-w-[260px] text-sm leading-[1.65] mt-3">
              The influencer marketing workspace for eCommerce brands and agencies.
            </p>
          </div>
          <div>
            <h4 className="text-white text-xs uppercase tracking-[0.1em] mb-4 font-[Manrope,sans-serif] font-bold">
              Products
            </h4>
            <ul className="list-none m-0 p-0">
              <li className="mb-2.5">
                <a href="/features" className="text-white/60 no-underline hover:text-white transition-colors">
                  Instroom Platform
                </a>
              </li>
              <li className="mb-2.5">
                <a href="#" className="text-white/60 no-underline hover:text-white transition-colors">
                  Chrome Extension
                </a>
              </li>
              <li className="mb-2.5">
                <a href="#" className="text-white/60 no-underline hover:text-white transition-colors">
                  Post Tracker
                </a>
              </li>
              <li className="mb-2.5">
                <a href="/features" className="text-white/60 no-underline hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li className="mb-2.5">
                <a href="/pricing" className="text-white/60 no-underline hover:text-white transition-colors">
                  Pricing
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-white text-xs uppercase tracking-[0.1em] mb-4 font-[Manrope,sans-serif] font-bold">
              Resources
            </h4>
            <ul className="list-none m-0 p-0">
              <li className="mb-2.5">
                <a href="#" className="text-white/60 no-underline hover:text-white transition-colors">
                  Blog
                </a>
              </li>
              <li className="mb-2.5">
                <a href="#" className="text-white/60 no-underline hover:text-white transition-colors">
                  FAQ&apos;s
                </a>
              </li>
              <li className="mb-2.5">
                <a href="#" className="text-white/60 no-underline hover:text-white transition-colors">
                  Demo
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-white text-xs uppercase tracking-[0.1em] mb-4 font-[Manrope,sans-serif] font-bold">
              Company
            </h4>
            <ul className="list-none m-0 p-0">
              <li className="mb-2.5">
                <a href="/about" className="text-white/60 no-underline hover:text-white transition-colors">
                  About
                </a>
              </li>
              <li className="mb-2.5">
                <a href="#" className="text-white/60 no-underline hover:text-white transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="flex justify-between flex-wrap gap-3 text-[0.8125rem] text-white/40 max-w-[1140px] mx-auto px-6 pt-6 border-t border-white/[0.08]">
          <p>&copy; 2026 Instroom. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/terms-of-service" className="text-white/50 no-underline hover:text-white">
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-white/50 no-underline hover:text-white">
              Privacy Policy
            </Link>
            <Link href="/refund" className="text-white/50 no-underline hover:text-white">
              Refund Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
