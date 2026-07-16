"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MainHeader } from "@/components/shared/main-header"
import { MainFooter } from "@/components/shared/main-footer"
import { IconSearch, IconFilter } from "@tabler/icons-react"
import {
  PipelineMockup,
  EmailMockup,
  CrmMockup,
  ReportingMockup,
  BrandPartnersMockup,
} from "@/components/shared/feature-mockups"

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
        className="pt-14 pb-12 text-center bg-[#F4F7F5]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(31,174,91,0.12) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      >
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(31,174,91,0.28)] bg-[rgba(31,174,91,0.1)] pl-2.5 pr-3.5 py-1.5 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1FAE5B] animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#0F6B3E]">
              What&apos;s Inside
            </span>
          </div>
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
            <PipelineMockup />
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
            <EmailMockup className="min-[901px]:order-1" />
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
            <CrmMockup />
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
            <ReportingMockup className="min-[901px]:order-1" />
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
            <BrandPartnersMockup />
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