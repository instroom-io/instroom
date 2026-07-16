"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { MainHeader } from "@/components/shared/main-header"
import { MainFooter } from "@/components/shared/main-footer"
import {
  PipelineMockup,
  EmailMockup,
  CrmMockup,
  ReportingMockup,
  BrandPartnersMockup,
} from "@/components/shared/feature-mockups"
import styles from "./landing-page.module.css"
import {
  IconSearch,
  IconMail,
  IconUsers,
  IconGitBranch,
  IconCircleCheck,
  IconBuildingStore,
  IconChartBar,
  IconFilter,
  IconStarFilled,
  IconArrowsMove,
} from "@tabler/icons-react"

const HERO_SIDEBAR_ICONS = [
  { Icon: IconSearch, label: "Discovery", active: false },
  { Icon: IconMail, label: "Inbox", active: false },
  { Icon: IconUsers, label: "Influencers List", active: false },
  { Icon: IconGitBranch, label: "Pipeline", active: true },
  { Icon: IconCircleCheck, label: "Post Tracker", active: false },
  { Icon: IconBuildingStore, label: "Brand Partners", active: false },
  { Icon: IconChartBar, label: "Analytics", active: false },
]

type HeroPipelineCard = {
  empty?: boolean
  name?: string
  handle?: string
  blur?: boolean
  platform?: string
  location?: string
  followers?: string
  eng?: string
  reason?: string
}

const HERO_PIPELINE_COLUMNS: {
  key: string
  title: string
  count: number
  headerClass: string
  badgeClass: string
  actionType: "flow" | "dealAgreed" | "notInterested"
  nextLabel?: string
  cards: HeroPipelineCard[]
}[] = [
  {
    key: "outreach",
    title: "For Outreach",
    count: 1,
    headerClass: "bg-yellow-400 text-white",
    badgeClass: "bg-white/25 text-white",
    actionType: "flow",
    nextLabel: "Contacted",
    cards: [
      { name: "Alex Rivera", handle: "@alexcreates", blur: true, platform: "IG", location: "Philippines", followers: "1.0K", eng: "0.4%" },
    ],
  },
  {
    key: "contacted",
    title: "Contacted",
    count: 1,
    headerClass: "bg-orange-400 text-white",
    badgeClass: "bg-white/25 text-white",
    actionType: "flow",
    nextLabel: "In Conversation",
    cards: [
      { name: "Taylor Brooks", handle: "@taylorbrooks", blur: true, platform: "IG", location: "Netherlands", followers: "2.1K", eng: "1.0%" },
    ],
  },
  {
    key: "conversation",
    title: "In Conversation",
    count: 1,
    headerClass: "bg-blue-400 text-white",
    badgeClass: "bg-white/25 text-white",
    actionType: "flow",
    nextLabel: "Deal Agreed",
    cards: [
      { name: "Devon Cruz", handle: "@devoncruz", blur: true, platform: "IG", location: "—", followers: "3", eng: "0.0%" },
    ],
  },
  {
    key: "deal-agreed",
    title: "Deal Agreed",
    count: 3,
    headerClass: "bg-green-500 text-white",
    badgeClass: "bg-white/25 text-white",
    actionType: "dealAgreed",
    cards: [
      { name: "Jordan Lee", handle: "@jordanlee.co", blur: true, platform: "IG", location: "Philippines", followers: "1.8K", eng: "2.7%" },
      { name: "Sharon Wells", handle: "@liefssharon", blur: false, platform: "IG", location: "Netherlands", followers: "3.0K", eng: "0.0%" },
      { name: "Priya N.", handle: "@priyanco", blur: true, platform: "IG", location: "—", followers: "13.0K", eng: "0.0%" },
    ],
  },
  {
    key: "not-interested",
    title: "Not Interested",
    count: 2,
    headerClass: "bg-red-100 text-red-700 border border-red-200",
    badgeClass: "bg-red-200 text-red-700",
    actionType: "notInterested",
    cards: [
      { name: "Suzanne K.", handle: "@suzannek", blur: true, platform: "IG", location: "—", followers: "1", eng: "0.0%", reason: "Fully booked" },
      { name: "Morgan T.", handle: "@morgant", blur: true, platform: "IG", location: "—", followers: "7", eng: "0.0%", reason: "Wrong audience fit" },
    ],
  },
]

export function LandingPage() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  useEffect(() => {
    const tabs = document.querySelectorAll(`.${styles.insideFeatTab}`)
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = (tab as HTMLElement).dataset.tab
        const container = tab.closest(`.${styles.containerMd}`)
        if (!container || !target) return
        container.querySelectorAll(`.${styles.insideFeatTab}`).forEach(t => t.classList.remove(styles.tabActive))
        container.querySelectorAll(`.${styles.insideFeatPanel}`).forEach(p => p.classList.remove(styles.panelActive))
        tab.classList.add(styles.tabActive)
        const panel = container.querySelector(`[data-panel="${target}"]`)
        if (panel) panel.classList.add(styles.panelActive)
      })
    })
  }, [])

  const faqs = [
    { q: "Do I need the full platform, or can I start with just the Chrome Extension?", a: "Either works. The Chrome Extension and Post Tracker are standalone products with their own pricing. You can use them without ever signing up for the full platform. If you want everything in one workspace later, you can connect them to Instroom and your data carries over." },
    { q: "What happens after the 30-day trial?", a: "Nothing automatic. We don't ask for a credit card to start, so the trial doesn't convert into a paid plan on its own. If you decide to keep using Instroom, you pick a plan and add payment details. If you don't, your account stays read-only and your data is preserved for 30 days." },
    { q: "Can I import my existing creator data from spreadsheets?", a: "Yes. You can import creators via CSV during setup or any time after. We keep the import flexible because we know every agency's spreadsheet is laid out differently." },
    { q: "Is my data secure, especially if I'm managing client campaigns?", a: "Yes. Each workspace is isolated, and access is controlled by role-based permissions (Admin, Manager, Viewer, Researcher). Shared workspaces work like Google Drive, you control who can see and edit what. See our Privacy Policy for full details." },
    { q: "What if I outgrow my plan?", a: "Upgrade any time. Solo accounts can move to Team when they need more than one workspace. Team accounts can add extra workspaces at $12/month each. Everything you've built carries over, no migration required." },
    { q: "You said the product is still being built. What does that mean for me?", a: "The core platform (campaigns, creator CRM, outreach, tracking) is live and working. Some add-ons like Discovery, Shopify Connect, and Affiliate Tracking are still in development. If you sign up now, you get the core, and new tools roll out as they're ready. Early users have a direct line to us for feedback and feature requests." },
  ]

  const problems = [
    { title: "Every campaign starts from zero.", desc: "Before you've contacted a single creator, you're already building a tracker. Setting up columns. Writing formulas. The wheel has already been invented. You shouldn't have to build it every time." },
    { title: "Your campaign lives in five different places.", desc: "Outreach in one tool. Tracking in another. Content saved somewhere. Reports in a third. No one has the full picture, and getting it means interrupting three people." },
    { title: "You're funding features you've never opened.", desc: "The platforms that have what you need charge for everything else too. Your budget should go toward creators, not software you're using 20% of." }
  ]

  const outcomes = [
    { label: "Problem 1", problem: "Every campaign starts from zero", solution: "Pre-built, ready on day one.", desc: "Campaign structure, creator fields, pipeline stages, all set up for you. You import your creators and start running, not building." },
    { label: "Problem 2", problem: "Your campaign lives in five different places", solution: "One workspace. One source of truth.", desc: "Outreach, tracking, content, and reporting all live in the same place. Your whole team sees the same thing without chasing anyone." },
    { label: "Problem 3", problem: "You're funding features you've never opened", solution: "Pay for the core. Add only what you use.", desc: "Start with the main platform. Add the Chrome Extension, Post Tracker, or other tools only when you need them. Or just use them standalone, no platform required." }
  ]

  const features = [
    { eyebrow: "Pipeline management", title: "See your campaign the way you think.", desc: "Every agency has someone who wants a spreadsheet and someone who wants a board. In Instroom, you get both. Flip between list view and Kanban with one click. The data is the same, the view changes with how your brain is working that day.", link: "instroom_features.html#pipeline" },
    { eyebrow: "Embedded email", title: "Reach out without leaving the room.", desc: "Send outreach, reply to creators, and track every thread inside Instroom. Every email is tied to the right creator and the right pipeline stage, so nothing gets lost in someone's Gmail folder. When a teammate picks up a reply at 9am, they have the full context.", link: "instroom_features.html#email" },
    { eyebrow: "Creator CRM", title: "Every creator, every detail, remembered.", desc: "Profiles hold everything. Every campaign they've run. Every post they've published. Every payment, every note, every tag. Six months from now when you're deciding who to bring back, the history is right there. No more digging through old threads.", link: "instroom_features.html#crm" },
    { eyebrow: "Reporting", title: "Client reports in one click.", desc: "No more Sunday nights spent copying screenshots into a slide deck. Pick the campaign, pick the date range, and Instroom pulls a clean report with posts, results, and revenue per creator. Share it as a link or export a PDF.", link: "instroom_features.html#reporting" },
    { eyebrow: "Brand Partners", title: "Turn one-off creators into long-term partners.", desc: "The creators who consistently deliver deserve more than a spreadsheet row. Brand Partners gives them a real home. Tiered status (Bronze, Silver, Gold) based on actual performance. Retainer tracking. Full history of every campaign they've run with you. So the next budget conversation isn't a guess.", link: "instroom_features.html#brand-partners" }
  ]

  const comparisons = [
    { spreadsheet: "Rebuild the tracker every campaign", instroom: "Pre-built campaign structure on day one" },
    { spreadsheet: "Rows and columns only", instroom: "Spreadsheet view or Kanban board, your choice" },
    { spreadsheet: "Manual status updates", instroom: "Status updates tied to actual activity" },
    { spreadsheet: "One person holds the system together", instroom: "Your whole team sees the same thing" },
    { spreadsheet: "Screenshots and copy-paste for client reports", instroom: "Clean reports, one click" },
    { spreadsheet: "Costs you hours every week", instroom: "Gives time back" }
  ]

  return (
    <div className="font-sans text-zinc-900 bg-white">
      <style jsx global>{`
        @keyframes dotPulse {0%,100%{opacity:.35}50%{opacity:1}}
        @keyframes tagPop {0%,26%{opacity:0;transform:scale(.5)}36%{opacity:1;transform:scale(1.12)}44%,88%{opacity:1;transform:scale(1)}95%,100%{opacity:0}}
        @keyframes heroCardDrag {
          0%{opacity:0;left:3%;top:34%;transform:rotate(0) scale(1);box-shadow:0 2px 6px rgba(0,0,0,.10)}
          6%{opacity:1}
          30%{left:23%;top:20%;transform:translateY(-6px) rotate(-3deg) scale(1.05);box-shadow:0 12px 24px rgba(15,107,62,.28)}
          55%{left:43%;top:14%;transform:translateY(-6px) rotate(-2deg) scale(1.04);box-shadow:0 12px 24px rgba(15,107,62,.28)}
          75%{left:59%;top:26%;transform:rotate(0) scale(1);box-shadow:0 2px 6px rgba(0,0,0,.10)}
          90%{opacity:1;left:59%;top:26%}
          96%{opacity:0;left:59%;top:26%}
          97%{opacity:0;left:3%;top:34%}
          100%{opacity:0}
        }
        @keyframes cardDrag {
          0%{opacity:0;left:3%;top:34%;transform:rotate(0) scale(1);box-shadow:0 2px 6px rgba(0,0,0,.10)}
          6%{opacity:1}
          30%{left:23%;top:20%;transform:translateY(-6px) rotate(-3deg) scale(1.05);box-shadow:0 12px 24px rgba(15,107,62,.28)}
          55%{left:43%;top:14%;transform:translateY(-6px) rotate(-2deg) scale(1.04);box-shadow:0 12px 24px rgba(15,107,62,.28)}
          75%{left:59%;top:26%;transform:rotate(0) scale(1);box-shadow:0 2px 6px rgba(0,0,0,.10)}
          90%{opacity:1;left:59%;top:26%}
          96%{opacity:0;left:59%;top:26%}
          97%{opacity:0;left:3%;top:34%}
          100%{opacity:0}
        }
        @keyframes emailIn {0%{opacity:0;transform:translateY(-16px)}12%{opacity:1;transform:translateY(0)}84%{opacity:1;transform:translateY(0)}95%{opacity:0;transform:translateY(-8px)}100%{opacity:0}}
        @keyframes tlIn {0%{opacity:0;transform:translateY(7px)}12%{opacity:1;transform:translateY(0)}84%{opacity:1;transform:translateY(0)}96%{opacity:0;transform:translateY(-4px)}100%{opacity:0}}
        @keyframes fillGold {0%,50%{width:0}72%,90%{width:100%}96%,100%{width:0}}
        @keyframes fillSilver {0%,30%{width:0}50%,90%{width:72%}96%,100%{width:0}}
        @keyframes fillBronze {0%,8%{width:0}30%,90%{width:44%}96%,100%{width:0}}
      `}</style>

      {/* NAV */}
      <MainHeader />

      {/* HERO */}
      <section className={`${styles.hero} ${styles.secEven}`}>
        <div className={styles.heroInner}>

          {/* LEFT: text column */}
          <div className={styles.heroLeft}>
            <div className={styles.heroEyebrow}>
              <div className={styles.heroEyebrowDot} />
              Influencer marketing, organized
            </div>
            <h1 className={styles.heroH1} style={{ fontFamily: "'Manrope', sans-serif", fontSize: "52px", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.03em", marginBottom: "24px" }}>Influencer marketing isn't <span style={{ textDecoration: "line-through", textDecorationColor: "#a1a1aa", textDecorationThickness: "3px", color: "#a1a1aa" }}>complicated</span>.<br />Managing it without the <span style={{ color: "#1FAE5B" }}>right system</span> is.</h1>
            <p className={styles.heroLead}>
              Instroom is the system. Every creator, every campaign, every result — in one workspace. Built by people who've done the work.
            </p>
            <div className={styles.heroCtas}>
              <Link href="/signup">
                <Button className="bg-gradient-to-r from-[#0F6B3E] to-[#1FAE5B] text-white font-semibold h-12 px-8 hover:from-[#0a5a2f] hover:to-[#158a48] shadow-lg shadow-emerald-500/25 rounded-xl">
                  Start Free Trial
                </Button>
              </Link>
              <a href="#features">
                <Button
                  variant="outline"
                  className="h-12 px-8 rounded-xl border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 hover:border-zinc-400 font-semibold"
                >
                  See how it works
                </Button>
              </a>
            </div>
            <p className={styles.heroSub}>No credit card required · 30-day free trial</p>
          </div>

        {/* RIGHT: product mockup */}
        <div className={styles.heroRight}>
          <div className={styles.heroMockup}>
            <div className="h-full w-full flex font-[Inter,system-ui,-apple-system,sans-serif] overflow-hidden">
              {/* Sidebar */}
              <div className="w-[128px] shrink-0 bg-[#0F6B3E] flex flex-col pt-3 pb-2 px-2 gap-3">
                <Image src="/INSTROOM WHITE.png" alt="Instroom" width={72} height={15} className="object-contain self-center" />
                <div className="w-full h-px bg-white/20" />
                <div className="flex flex-col gap-1">
                  {HERO_SIDEBAR_ICONS.map(({ Icon, label, active }, i) => (
                    <div
                      key={i}
                      className={`h-5.5 px-1.5 rounded-md flex items-center gap-1.5 ${active ? "bg-[#1FAE5B]" : ""}`}
                    >
                      <Icon size={10} stroke={1.75} className="text-white shrink-0" />
                      <span className="text-[7.5px] font-medium text-white truncate">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Main panel */}
              <div className="flex-1 min-w-0 bg-white flex flex-col">
                {/* Toolbar */}
                <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-[#eef1f0] shrink-0">
                  <div className="flex items-center gap-1 h-5 px-1.5 rounded-md border border-[#0F6B3E]/15 text-[7px] text-[#9aa4a0]">
                    <IconSearch size={9} stroke={2} />
                    Search...
                  </div>
                  <div className="flex items-center gap-1 h-5 px-1.5 rounded-md border border-[#0F6B3E]/15 text-[7px] text-[#52525b] font-semibold">
                    <IconFilter size={9} stroke={2} />
                    Filters
                  </div>
                  <span className="text-[7px] text-[#9aa4a0] font-medium">12 influencers</span>
                  <div className="ml-auto flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1FAE5B]" style={{ animation: "dotPulse 1.4s ease-in-out infinite" }} />
                    <span className="text-[7px] font-semibold text-[#9aa4a0]">Live</span>
                  </div>
                </div>

                {/* Kanban board */}
                <div className="relative flex-1 min-h-0 flex gap-1.5 p-2">
                  {HERO_PIPELINE_COLUMNS.map((col) => (
                    <div key={col.key} className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className={`rounded-[5px] px-1.5 py-1 text-[6.5px] font-bold flex items-center justify-between gap-1 ${col.headerClass}`}>
                        <span className="truncate">{col.title}</span>
                        <span className={`rounded-full px-1 shrink-0 ${col.badgeClass}`}>{col.cards.length}</span>
                      </div>
                      <div className="flex flex-col gap-1 flex-1 min-h-0">
                        {col.cards.map((card, i) =>
                          card.empty ? (
                            <div key={i} className="flex-1 min-h-[22px] rounded-[5px] border border-dashed border-[#e3e7e5]" />
                          ) : (
                            <div key={i} className="bg-white border border-[#eef1f0] rounded-[5px] p-1.5 flex flex-col gap-[3px]">
                              <div>
                                <div
                                  className="text-[6.5px] font-semibold text-[#1E1E1E] leading-tight truncate"
                                  style={card.blur ? { filter: "blur(2.5px)" } : undefined}
                                >
                                  {card.name}
                                </div>
                                <div
                                  className="text-[6px] text-[#9aa4a0] leading-tight truncate"
                                  style={card.blur ? { filter: "blur(2.5px)" } : undefined}
                                >
                                  {card.handle}
                                </div>
                              </div>
                              <div className="text-[5.5px] text-[#9aa4a0] leading-tight truncate">
                                {card.platform} · {card.location}
                              </div>
                              <div className="text-[5.5px] text-[#9aa4a0] leading-tight truncate">
                                {card.followers} · {card.eng} eng
                              </div>
                              {col.actionType === "flow" && (
                                <div className="flex items-center gap-1 mt-px">
                                  <span className="text-[5px] font-semibold text-[#0F6B3E] bg-green-50 border border-green-200 rounded px-1 py-px truncate">
                                    → {col.nextLabel}
                                  </span>
                                  <span className="text-[5px] font-semibold text-red-500 bg-red-50 border border-red-100 rounded px-1 py-px">
                                    ✕
                                  </span>
                                </div>
                              )}
                              {col.actionType === "dealAgreed" && (
                                <div className="text-[5px] font-semibold text-white bg-[#1FAE5B] rounded px-1 py-[2px] text-center mt-px truncate">
                                  Move to Post Tracker
                                </div>
                              )}
                              {col.actionType === "notInterested" && (
                                <div className="text-[5px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded px-1 py-px mt-px truncate">
                                  {card.reason}
                                </div>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Animated gliding card */}
                  <div
                    className="absolute p-1.5 rounded-[5px] bg-white border-[1.5px] border-[#1FAE5B]"
                    style={{ width: "17%", animation: "heroCardDrag 6s cubic-bezier(.22,1,.36,1) infinite" }}
                  >
                    <div className="text-[6.5px] font-semibold text-[#1E1E1E] truncate">Sharon Wells</div>
                    <div className="text-[6px] text-[#9aa4a0] truncate">@liefssharon</div>
                  </div>

                  {/* Revenue stat chip, docked in the open corner beside the board */}
                  <div className={styles.heroFloatBadge} style={{ bottom: "2%", right: "1%" }}>
                    <div className={styles.heroBadgeDot} style={{ animation: "dotPulse 1.4s ease-in-out infinite" }} />
                    $48.2K tracked this month
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.heroBadge}>
            <div className={styles.heroBadgeDot} />
            200+ campaigns managed
          </div>

          <div className={`${styles.heroFloatBadge} ${styles.heroFloatTop}`}>
            <IconStarFilled size={12} className="text-[#F4C24A]" />
            4.9/5 average rating
          </div>

          <div className={`${styles.heroFloatBadge} ${styles.heroFloatBottom}`}>
            <IconArrowsMove size={12} className="text-[#1FAE5B]" />
            Drag &amp; drop pipeline
          </div>
        </div>

        </div>
      </section>

            {/* TRUST BAR */}
      <section className={`${styles.trust} ${styles.secEven}`}>
        <div className={styles.containerMd}>
          <p className={styles.trustLabel}>Built from 200+ brands, campaigns, and hard-won lessons</p>
          <div className={styles.trustLogos}>
            <div className={styles.trustCarousel}>
              {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17].map((num) => (
                <div key={num} className={styles.trustLogo}>
                  <Image src={`/images/brandLogo/${num}.png`} alt={`Brand ${num}`} width={380} height={105} style={{ objectFit: "contain", height: "105px", width: "auto", maxWidth: "380px" }} />
                </div>
              ))}
              {/* Duplicate logos for seamless loop */}
              {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17].map((num) => (
                <div key={`dup-${num}`} className={styles.trustLogo}>
                  <Image src={`/images/brandLogo/${num}.png`} alt={`Brand ${num}`} width={380} height={105} style={{ objectFit: "contain", height: "105px", width: "auto", maxWidth: "380px" }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className={`${styles.stats} ${styles.secOdd}`}>
        <div className={styles.containerMd}>
          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <div className={styles.statNum}>200+</div>
              <div className={styles.statLabel}>Campaigns managed</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statNum}>100,000+</div>
              <div className={styles.statLabel}>Creator relationships</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statNum}>$10M+</div>
              <div className={styles.statLabel}>In sales generated</div>
            </div>
          </div>
          <p className="text-xs text-zinc-400 italic mt-4 text-center">Approximate totals across the brands we've worked with.</p>
        </div>
      </section>


      {/* PROBLEM */}
      <section className={`${styles.section} ${styles.secOdd}`} style={{ paddingTop: "48px" }}>
        <div className={styles.containerMd}>
          <div className={styles.sectionHeader}>
            <h2>You didn't start your brand to live in a spreadsheet.</h2>
            <p>But here you are. Multiple tabs. Multiple tools. A nagging feeling that you're paying creators and hoping it's working.</p>
          </div>
          <div className={styles.problemCards}>
            {problems.map((problem, index) => (
              <div key={index} className={styles.problemCard}>
                <div className={styles.problemCardNum}>{index + 1}</div>
                <h3>{problem.title}</h3>
                <p>{problem.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OUTCOMES */}
      <section className={`${styles.section} ${styles.secEven}`}>
        <div className={styles.containerMd}>
          <div className={styles.sectionHeader}>
            <h2>Here's what changes with Instroom.</h2>
          </div>
          <div className={styles.outcomesGrid}>
            {outcomes.map((outcome, index) => (
              <div key={index} className={styles.outcome}>
                <div className={styles.outcomeLabel}>{outcome.label}</div>
                <div className={styles.outcomeProblem}>{outcome.problem}</div>
                <div className={styles.outcomeDivider} />
                <h3>{outcome.solution}</h3>
                <p>{outcome.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHAT'S INSIDE — Tabbed */}
      <section className={`${styles.section} ${styles.secOdd}`} id="features">
        <div className={styles.containerMd}>
          <div className={styles.insideTabbedIntro}>
            <h2>What&rsquo;s inside Instroom.</h2>
            <p>Five core tools that replace the stack you&rsquo;ve been duct-taping together. Click through to see each one.</p>
          </div>

          <div className={styles.insideFeatTabs}>
            <button className={`${styles.insideFeatTab} ${styles.tabActive}`} data-tab="pipeline">Pipeline</button>
            <button className={styles.insideFeatTab} data-tab="email">Email</button>
            <button className={styles.insideFeatTab} data-tab="crm">Creator CRM</button>
            <button className={styles.insideFeatTab} data-tab="reporting">Reporting</button>
            <button className={styles.insideFeatTab} data-tab="brand-partners">Brand Partners</button>
          </div>

          <div>
            {/* Pipeline */}
            <div className={`${styles.insideFeatPanel} ${styles.panelActive}`} data-panel="pipeline">
              <div className={styles.insideFeatGrid}>
                <PipelineMockup />
                <div>
                  <div className={styles.insideFeatEyebrow}>Pipeline management</div>
                  <h3>Work the way you want. List, board, or both.</h3>
                  <p className={styles.insideFeatLead}>The same data in two views. See everything in a Kanban board or scan fast in a spreadsheet view. Switch between them in one click.</p>
                  <ul className={styles.insideFeatBullets}>
                    <li>Pre-built pipeline stages per campaign</li>
                    <li>List or Kanban view, your choice</li>
                    <li>Drag and drop to update stages</li>
                    <li>Bulk actions: update or assign in one move</li>
                  </ul>
                  <a href="landing-nav/features#pipeline" className={styles.insideFeatLink}>See full details &rarr;</a>
                </div>
              </div>
            </div>

            {/* Email */}
            <div className={styles.insideFeatPanel} data-panel="email">
              <div className={styles.insideFeatGrid}>
                <EmailMockup />
                <div>
                  <div className={styles.insideFeatEyebrow}>Embedded Email</div>
                  <h3>Reach out, reply, and track without leaving Instroom.</h3>
                  <p className={styles.insideFeatLead}>Your inbox lives inside the workspace. Every email auto-tagged to the right campaign and stage, so context never gets lost.</p>
                  <ul className={styles.insideFeatBullets}>
                    <li>Connect Gmail or Outlook in one click</li>
                    <li>Auto-tagged to campaign and pipeline stage</li>
                    <li>Templates with creator variables</li>
                    <li>Full thread history on every creator profile</li>
                  </ul>
                  <a href="landing-nav/features#email" className={styles.insideFeatLink}>See full details &rarr;</a>
                </div>
              </div>
            </div>

            {/* Creator CRM */}
            <div className={styles.insideFeatPanel} data-panel="crm">
              <div className={styles.insideFeatGrid}>
                <CrmMockup />
                <div>
                  <div className={styles.insideFeatEyebrow}>Creator CRM</div>
                  <h3>Profiles that remember everything.</h3>
                  <p className={styles.insideFeatLead}>Every campaign, every post, every payment, every conversation. When you come back to a creator six months later, the full history is waiting.</p>
                  <ul className={styles.insideFeatBullets}>
                    <li>Full campaign and content history</li>
                    <li>Payment and deal records attached</li>
                    <li>Tags, custom fields, and team notes</li>
                    <li>Shared across your team with roles</li>
                  </ul>
                  <a href="landing-nav/features#crm" className={styles.insideFeatLink}>See full details &rarr;</a>
                </div>
              </div>
            </div>

            {/* Reporting */}
            <div className={styles.insideFeatPanel} data-panel="reporting">
              <div className={styles.insideFeatGrid}>
                <ReportingMockup />
                <div>
                  <div className={styles.insideFeatEyebrow}>Reporting</div>
                  <h3>Client-ready reports, one click away.</h3>
                  <p className={styles.insideFeatLead}>Stop building reports the night before a client call. Pull performance by creator, campaign, or deliverable. Export PDFs or share live links.</p>
                  <ul className={styles.insideFeatBullets}>
                    <li>One-click campaign summaries</li>
                    <li>Per-creator performance breakdowns</li>
                    <li>Live-updating shareable links</li>
                    <li>Clean PDF exports for clients</li>
                  </ul>
                  <a href="landing-nav/features#reporting" className={styles.insideFeatLink}>See full details &rarr;</a>
                </div>
              </div>
            </div>

            {/* Brand Partners */}
            <div className={styles.insideFeatPanel} data-panel="brand-partners">
              <div className={styles.insideFeatGrid}>
                <BrandPartnersMockup />
                <div>
                  <div className={styles.insideFeatEyebrow}>Brand Partners</div>
                  <h3>Creators worth more than a campaign.</h3>
                  <p className={styles.insideFeatLead}>Some creators keep delivering, campaign after campaign. Brand Partners gives those relationships structure: tiered status, retainers, full history.</p>
                  <ul className={styles.insideFeatBullets}>
                    <li>Auto tier assignment based on revenue</li>
                    <li>Retainer and recurring deal tracking</li>
                    <li>Full performance history across campaigns</li>
                    <li>Community status: Invited, Joined, Pending</li>
                  </ul>
                  <a href="landing-nav/features#brand-partners" className={styles.insideFeatLink}>See full details &rarr;</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className={`${styles.section} ${styles.secEven}`}>
        <div className={styles.containerMd}>
          <div className={styles.sectionHeader}>
            <h2>Get started in minutes.</h2>
            <p>No onboarding call required. No setup fees. Just sign up and go.</p>
          </div>
          <div className={styles.howGrid}>
            <div className={styles.howStep}>
              <div className={styles.howNum}>1</div>
              <h3>Sign up free</h3>
              <p>30 days, full platform, no credit card. Create your workspace in under a minute.</p>
            </div>
            <div className={styles.howStep}>
              <div className={styles.howNum}>2</div>
              <h3>Import or start fresh</h3>
              <p>Bring your creators in from a spreadsheet, or start adding them from scratch. Your call.</p>
            </div>
            <div className={styles.howStep}>
              <div className={styles.howNum}>3</div>
              <h3>Run your first campaign</h3>
              <p>Outreach, tracking, and reporting from the same place. See how it feels before you pay a cent.</p>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className={`${styles.section} ${styles.secOdd}`}>
        <div className={styles.containerMd}>
          <div className={styles.sectionHeader}>
            <h2>Instroom vs. a spreadsheet.</h2>
            <p>If your spreadsheet works, keep using it. But here's what you're trading when you move.</p>
          </div>
          <div className={styles.compareTable}>
            <div className={styles.compareHeader}>
              <div className={styles.compareHeaderCell}>In a spreadsheet</div>
              <div className={styles.compareHeaderCell}>In Instroom</div>
            </div>
            {comparisons.map((item, index) => (
              <div key={index} className={styles.compareRow}>
                <div className={styles.compareCell}>{item.spreadsheet}</div>
                <div className={styles.compareCell}>
                  <span className={styles.compareIcon}>✓</span>{item.instroom}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

{/* FOUNDER */}
      <section className={`${styles.section} ${styles.secEven}`}>
        <div className={styles.containerMd}>
          <div className={styles.founderHeader}>
            <div className={styles.founderLabel}>A note from our founder</div>
            <h2>Why we built Instroom</h2>
          </div>
          <div className={styles.founderInner}>
            <div className={styles.founderImage}>
              <Image 
                src="/images/CEO.jpg" 
                alt="Armand Mañibo, Founder & CEO" 
                width={400} 
                height={500}
                className="w-full h-full object-cover"
              />
            </div>
            <div className={styles.founderContent}>
              <div className={`${styles.founderQuote} ${styles.fontHandQuote}`}>
                <p>Before Instroom, I ran an influencer marketing agency. And still do.</p>
                <p>Over the years we built a pretty organized system. A clean spreadsheet. Clear processes. A team that knew where everything lived. On paper, it worked.</p>
                <p>Then we scaled. We're now managing 30 brands, each with its own spreadsheet, and it's honestly insane. A spreadsheet can only do so much. We were jumping between six different tools to get one campaign out the door. One app for outreach. Another for tracking posts. Another for payments. Another for reporting to the client. Every tool was fine on its own. Together, they were exhausting.</p>
                <p>So we built Instroom. Not because our system was broken (maybe it is), but because the tools around it were. We wanted one workspace that could hold the whole campaign, from the first DM to the final report, without tabbing through five windows to find one number.</p>
                <p>Not everything is ready yet. We're still building, still improving, still listening to the people using it. But it's getting there, and we'd love for you to come along.</p>
              </div>
              <div className={styles.founderSign}>
                <div className={`${styles.founderName} ${styles.fontHand}`}>Armand Mañibo</div>
                <div className={styles.founderTitle}>Founder & CEO, Instroom</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STANDALONE */}
      <section className={`${styles.section} ${styles.secOdd}`} id="standalone">
        <div className={styles.containerMd}>
          <div className={styles.sectionHeader}>
            <h2>Not ready for the full workspace? Start with a piece.</h2>
            <p>The Chrome Extension and Post Tracker also work on their own. Use one today, grow into the full platform when you're ready.</p>
          </div>
          <div className={styles.standaloneGrid}>
            <div className={styles.standaloneCard}>
              <h3>Chrome Extension</h3>
              <p>Capture creator data while you browse Instagram and TikTok. Free forever, or $9/mo for pro tools.</p>
              <a href="#" className={styles.standaloneLink}>Learn more →</a>
            </div>
            <div className={styles.standaloneCard}>
              <h3>Post Tracker</h3>
              <p>Download and archive every piece of creator content, automatically. From $19/mo.</p>
              <a href="#" className={styles.standaloneLink}>Learn more →</a>
            </div>
          </div>
        </div>
      </section>

      {/* EARLY USERS / TESTIMONIAL PLACEHOLDER */}
      <section className={`${styles.early} ${styles.secEven}`}>
        <div className={styles.earlyInner}>
          <h2>No testimonials yet</h2>
          <p className={styles.earlyBody}>We're not going to make any up. Right now, we are our own testimonials. We use Instroom every day to run our agency across 30 brands, and that's the honest proof that it works.</p>
          <p className={`${styles.fontHand} text-3xl font-semibold text-[#0F6B3E] mb-8 leading-snug`}>
            Hopefully yours will live here soon.<br />Fingers crossed.
          </p>
          <Link href="/signup">
            <Button className="bg-gradient-to-r from-[#0F6B3E] to-[#1FAE5B] text-white font-semibold h-12 px-8 hover:from-[#0a5a2f] hover:to-[#158a48] rounded-xl shadow-lg shadow-emerald-600/20">
              Start free for 30 days
            </Button>
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className={`${styles.faq} ${styles.secOdd}`} id="faq">
        <div className={styles.containerMd}>
          <div className={styles.sectionHeader}>
            <h2>Questions you're probably asking.</h2>
          </div>
          <div className={styles.faqList}>
            {faqs.map((faq, index) => (
              <div
                key={index}
                className={`${styles.faqItem} ${expandedFaq === index ? styles.open : ''}`}
              >
                <button
                  className={styles.faqQ}
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                >
                  <span>{faq.q}</span>
                  <span className={styles.faqQIcon}>+</span>
                </button>
                {expandedFaq === index && (
                  <div className={styles.faqA}>{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className={styles.finalCta}>
        <div className={`${styles.containerMd} ${styles.finalCtaContent}`}>
          <h2>The system is ready. Your next campaign is waiting.</h2>
          <p className={styles.finalCtaLead}>Stop building the process. Start running the campaign.</p>
          <div className={styles.heroCtas} style={{ justifyContent: "center" }}>
            <Link href="/signup">
              <Button className="bg-[#1FAE5B] text-white font-bold h-13 px-9 rounded-xl hover:bg-[#158a48] shadow-lg shadow-emerald-500/40 text-base transition-all duration-150" style={{ height: "52px", fontSize: "1rem" }}>
                Start free for 30 days
              </Button>
            </Link>
            <a href="#faq">
              <Button
                variant="outline"
                className="h-13 px-9 rounded-xl border-2 border-white/40 text-white bg-transparent hover:bg-white/10 hover:border-white/60 font-semibold text-base transition-all duration-150" style={{ height: "52px", fontSize: "1rem" }}
              >
                Book a demo
              </Button>
            </a>
          </div>
          <p className={styles.finalCtaSub}>No credit card required · No annual contracts · Cancel anytime</p>
        </div>
      </section>

      {/* FOOTER */}
      <MainFooter />
    </div>
  )
}