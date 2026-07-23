"use client";

import { useState } from "react";
import { MainHeader } from "@/components/shared/main-header";
import { MainFooter } from "@/components/shared/main-footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Article {
  cat: string;
  title: string;
  heroImg: string;
  heroAlt: string;
  author: string;
  authorInitials: string;
  authorColor: string;
  date: string;
  read: string;
  body: string;
}

type ArticleSlug =
  | "roi-metrics"
  | "influencer-brief"
  | "micro-vs-macro"
  | "creator-economy-2025"
  | "rejection-insights"
  | "product-seeding"
  | "spreadsheet-vs-platform"
  | "cac-reduction";

// ─── Article Data ─────────────────────────────────────────────────────────────

const articles: Record<ArticleSlug, Article> = {
  "roi-metrics": {
    cat: "Strategy",
    title: "The 5 Metrics That Actually Predict Influencer Campaign ROI",
    heroImg: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1400&q=85&fit=crop",
    heroAlt: "Analytics dashboard showing marketing data",
    author: "Sara Reeves",
    authorInitials: "SR",
    authorColor: "linear-gradient(135deg,#1FAE5B,#0F6B3E)",
    date: "April 28, 2025",
    read: "8 min read",
    body: `
      <p>Every brand running influencer campaigns tracks something. But most are tracking the wrong things — and then wondering why their results don't match their spend. Follower count, reach, and raw impressions tell you how many people theoretically saw your content. They say almost nothing about whether it drove any meaningful outcome.</p>
      <p>After managing over 200 campaigns across eCommerce brands at Armful Media, and building Instroom to centralize all that data, we identified five metrics that consistently correlate with real campaign ROI. Here they are.</p>
      <figure class="article-img"><img src="https://images.unsplash.com/photo-1666875753105-c63a6f3bdc86?w=1200&q=80&fit=crop" alt="Marketing analytics and ROI charts" loading="lazy"><figcaption>Tracking the right metrics changes how you allocate budget — and how fast you scale.</figcaption></figure>
      <h2>1. Engagement Rate by Content Type</h2>
      <p>Not all engagement is equal. A comment on a tutorial video means something completely different from a like on a lifestyle photo. When evaluating creators, don't look at aggregate engagement rate — break it down by content format: Reels, carousels, static posts, Stories.</p>
      <p>A creator with a 3% engagement rate on static posts but an 8% rate on Reels is telling you exactly what format to brief them on. Most brands miss this entirely because they're looking at an averaged number that smooths out the signal.</p>
      <div class="callout"><p>Instroom tracks engagement by campaign stage and content format, so you can identify which creator + format combinations are outperforming before you scale spend.</p></div>
      <h2>2. Audience Overlap Score</h2>
      <p>If you're running five creators simultaneously, you need to know how much of their audiences actually overlap. High overlap means you're paying five times to reach largely the same people — a classic efficiency drain in multi-creator campaigns.</p>
      <p>The ideal overlap for a mid-funnel awareness campaign sits below 20%. For retargeting-style creator campaigns, some overlap is fine because repeated exposure is part of the strategy. Knowing your number lets you make that call deliberately rather than by accident.</p>
      <h2>3. Content Save Rate</h2>
      <p>Saves are one of the most underrated signals in influencer marketing. When someone saves a post, they're signaling purchase consideration — they want to come back to it. For product-led content, save rate is a stronger predictor of downstream conversion than likes or comments.</p>
      <div class="metric-row">
        <div class="metric-box"><div class="metric-box-num">4.2%</div><div class="metric-box-label">Avg save rate on high-converting posts</div></div>
        <div class="metric-box"><div class="metric-box-num">0.8%</div><div class="metric-box-label">Avg save rate on low-converting posts</div></div>
        <div class="metric-box"><div class="metric-box-num">5.3×</div><div class="metric-box-label">Difference in conversion likelihood</div></div>
      </div>
      <h2>4. Engagement Velocity (First 24 Hours)</h2>
      <p>The speed at which a post accumulates engagement matters as much as the total. Instagram and TikTok's algorithms reward posts that generate fast early interaction by amplifying them to non-follower audiences. A post that earns 60% of its engagement in the first two hours will outperform one that trickles in over a week — even if the final totals look the same.</p>
      <p>When running time-sensitive campaigns — product launches, limited drops, flash sales — prioritize creators whose historical posts show strong early velocity. This is a signal that their audience is genuinely engaged and checking their feed, not just passively scrolling past.</p>
      <h2>5. Repeat Creator Performance Lift</h2>
      <p>This one only becomes visible over time, but it's the most powerful signal in the dataset: how does a creator's performance change across their second, third, and fourth collaborations with your brand?</p>
      <p>The best creators get better with your brand over time. They understand your product more deeply, they get better audience feedback, they refine their angle. If a creator's first post delivers a 2% engagement rate and their third delivers 4.5%, that compounding lift is far more valuable than any one-off campaign metric.</p>
      <div class="callout"><p>Instroom's Creator CRM stores full campaign history per creator — every post, every result, every deal — so you can track performance lift across collaborations without rebuilding your tracker for every campaign.</p></div>
      <h2>The Bottom Line</h2>
      <p>Vanity metrics feel good to report, but they won't tell you where to put next quarter's budget. Track engagement by content type, watch your audience overlap, pay attention to saves and velocity, and build long enough relationships to measure performance lift. That's how you move from "we ran some influencer campaigns" to "influencer marketing is a core growth channel for us."</p>
    `,
  },
  "influencer-brief": {
    cat: "Strategy",
    title: "Why Your Influencer Brief Is Killing Engagement (And How to Fix It)",
    heroImg: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=1400&q=85&fit=crop",
    heroAlt: "Creator filming authentic content with smartphone",
    author: "Jake Kim",
    authorInitials: "JK",
    authorColor: "#1FAE5B",
    date: "April 24, 2025",
    read: "6 min read",
    body: `
      <p>There's a failure mode that shows up in almost every brand's first year of running influencer campaigns. They spend weeks identifying the perfect creator. They get the partnership agreed. Then they send a six-page brief with mandatory talking points, required hashtags, approval checkpoints, and a shot list that would make a TV producer wince.</p>
      <p>The content comes back technically compliant and completely dead. Their audience can tell it's an ad from the first frame.</p>
      <figure class="article-img"><img src="https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&q=80&fit=crop" alt="Team reviewing a creative brief together" loading="lazy"><figcaption>Creative alignment starts before the brief — not inside it.</figcaption></figure>
      <h2>The Research Is Clear</h2>
      <p>Over-scripted influencer content consistently underperforms creator-led posts. Studies across Instagram and TikTok campaigns show that posts where the creator had significant creative latitude earn 30–40% higher engagement than heavily directed content, even when the brand messaging is identical.</p>
      <p>The reason is simple: audiences follow creators for their voice, their style, their perspective. The moment that voice disappears and gets replaced by brand-speak, the audience mentally categorizes the content as advertising — and skips.</p>
      <div class="callout"><p>In Instroom's own dataset from 200+ managed campaigns, creator-led briefs that outlined outcomes rather than scripts outperformed directive briefs by an average of 34% on engagement rate.</p></div>
      <h2>What Most Briefs Get Wrong</h2>
      <p>The most common brief mistakes we see fall into three categories:</p>
      <ul>
        <li><strong>Mandating script verbatim.</strong> Giving a creator word-for-word lines to say is the fastest way to get stilted, unnatural content. Viewers can hear a script even when they can't explain why.</li>
        <li><strong>Over-specifying the format.</strong> Telling a creator who lives in long-form storytelling Reels to produce a 15-second cut-to-music transition video isn't a brief — it's a job posting for a different creator.</li>
        <li><strong>Excessive approval gates.</strong> Requiring script approval, then shot list approval, then draft approval, then final approval adds weeks to a campaign timeline and signals to the creator that you don't trust them.</li>
      </ul>
      <h2>The Three-Point Brief Framework</h2>
      <p>A strong influencer brief communicates three things: what you need the audience to know, what action you want them to take, and what's off-limits. Everything else is the creator's job.</p>
      <ul>
        <li><strong>The message:</strong> One sentence. What's the single most important thing the audience should take away?</li>
        <li><strong>The call to action:</strong> One action. Click the link, use the code, visit the store. Not three CTAs.</li>
        <li><strong>The guardrails:</strong> What can't they say? Keep this list short.</li>
      </ul>
      <h2>Managing Brand Safety Without Killing Creativity</h2>
      <p>The real goal of a brief isn't control — it's alignment. Before the brief, send the creator your product. Have a 15-minute call where they can ask questions. Share two or three examples of content you love — not to copy, but to calibrate tone. By the time you send the brief, they already have context. The brief just confirms the commercial details.</p>
      <div class="callout"><p>Instroom's Creator CRM keeps a full history of every creator you've worked with — their past content, their notes, their deal terms. When you rebook a creator, they're not starting from zero. Neither are you.</p></div>
    `,
  },
  "micro-vs-macro": {
    cat: "Analytics",
    title: "Micro vs. Macro Influencers: A Data-Backed Decision Framework for DTC Brands",
    heroImg: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1400&q=85&fit=crop",
    heroAlt: "Data analytics on laptop screen",
    author: "Anika Mehta",
    authorInitials: "AM",
    authorColor: "#3b82f6",
    date: "April 20, 2025",
    read: "9 min read",
    body: `
      <p>The micro vs. macro influencer debate has been running since at least 2018, and it's still generating takes that are more confident than they are accurate. "Micro-influencers always have better engagement." "Macro reach is worth the premium." The truth is that it depends — and the "depends on what" is actually knowable if you're tracking the right variables.</p>
      <figure class="article-img"><img src="https://images.unsplash.com/photo-1599658880436-c61792e70672?w=1200&q=80&fit=crop" alt="Social media influencer creating content" loading="lazy"><figcaption>Both tiers win — the question is which one wins for your specific goal.</figcaption></figure>
      <h2>Defining the Tiers</h2>
      <ul>
        <li><strong>Nano (1K–10K followers):</strong> Hyper-local, often personal audiences. High trust, low reach.</li>
        <li><strong>Micro (10K–100K followers):</strong> Niche authority. Strong engagement, affordable, highly targetable.</li>
        <li><strong>Macro (100K–1M followers):</strong> Broad reach, professional creators, higher CPM.</li>
        <li><strong>Mega / Celebrity (1M+):</strong> Mass awareness, lowest engagement rate, highest spend.</li>
      </ul>
      <h2>Where Micro Wins</h2>
      <p>Micro-influencers consistently outperform on three dimensions: engagement rate, conversion rate from affiliate links, and audience trust signals. When your goal is to drive someone from "I've never heard of this brand" to "I just bought it," micro is usually the more efficient path.</p>
      <div class="metric-row">
        <div class="metric-box"><div class="metric-box-num">6.2%</div><div class="metric-box-label">Avg engagement rate, micro (10K–100K)</div></div>
        <div class="metric-box"><div class="metric-box-num">2.1%</div><div class="metric-box-label">Avg engagement rate, macro (100K–1M)</div></div>
        <div class="metric-box"><div class="metric-box-num">3.8×</div><div class="metric-box-label">Higher conversion rate, micro vs. macro</div></div>
      </div>
      <div class="callout"><p>For DTC brands with a specific customer profile, 10 well-chosen micro creators will almost always outperform one macro at the same budget. The key word is "well-chosen."</p></div>
      <h2>Where Macro Wins</h2>
      <p>Macro influencers earn their premium when awareness velocity matters more than efficiency. If you're launching a new product category, entering a new market, or need to build brand recognition fast, macro reach compresses the timeline in a way that micro campaigns simply can't match at the same pace.</p>
      <h2>The Campaign-Goal Decision Matrix</h2>
      <ul>
        <li><strong>Launch a new product → Macro</strong> for initial awareness spike, then micro for sustained conversion.</li>
        <li><strong>Drive direct sales → Micro</strong> with affiliate codes or discount links. Track per-creator ROAS.</li>
        <li><strong>Build brand credibility in a niche → Micro</strong> through consistent, repeated placements.</li>
        <li><strong>Enter a new geographic market → Macro</strong> to establish presence, then localized micro for conversion.</li>
        <li><strong>Content production for paid ads → Nano or micro</strong> for volume of authentic UGC at scale.</li>
      </ul>
      <h2>The Budget Allocation Model</h2>
      <p>For most DTC brands in a growth phase, a 70/30 split works well: 70% toward micro campaigns for conversion efficiency, 30% toward one or two macro placements for reach and brand-building. What kills performance is treating this as a binary choice. The most effective programs use both — with clear goals, tracked outcomes, and a system that lets you see which is working.</p>
    `,
  },
  "creator-economy-2025": {
    cat: "Trends",
    title: "Creator Economy 2025: The Trends Reshaping Influencer Marketing This Year",
    heroImg: "https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=1400&q=85&fit=crop",
    heroAlt: "Content creator recording a video at home studio",
    author: "Leila Osei",
    authorInitials: "LO",
    authorColor: "#f59e0b",
    date: "April 16, 2025",
    read: "7 min read",
    body: `
      <p>The creator economy isn't what it was two years ago. Platforms have shifted their algorithms, creator expectations around compensation have changed, and the brands that are winning with influencer marketing in 2025 are running a fundamentally different playbook from the ones that worked in 2022.</p>
      <figure class="article-img"><img src="https://images.unsplash.com/photo-1616469829581-73993eb86b02?w=1200&q=80&fit=crop" alt="Creator economy and social media growth" loading="lazy"><figcaption>The shift to performance-linked pay is redefining how brands and creators work together.</figcaption></figure>
      <h2>1. Performance-Linked Creator Pay Is Becoming Standard</h2>
      <p>For years, influencer marketing operated almost entirely on flat fees: a creator posts, a brand pays, the results are whatever they are. That model is giving way to hybrid structures where a base fee is supplemented by performance bonuses tied to actual outcomes — affiliate sales, link clicks, discount code redemptions, or tracked conversions.</p>
      <div class="callout"><p>Instroom tracks deal terms, deliverables, and campaign results per creator in one workspace. As performance-linked pay becomes the norm, having that history is essential for renegotiating and scaling what's working.</p></div>
      <h2>2. UGC Has Become a Standalone Strategy</h2>
      <p>User-generated content — product-focused creative made by creators, not necessarily posted to their own audiences — has grown from a nice-to-have into a full creative production category. Brands are briefing micro and nano creators specifically to produce content for paid ads, website assets, and email campaigns. UGC converts at a higher rate in paid social than brand-produced creative, it's faster and cheaper to produce, and the volume means you always have fresh material for testing.</p>
      <h2>3. Long-Term Brand Partnerships Are Replacing One-Off Posts</h2>
      <p>The single sponsored post is increasingly seen as the least efficient unit in influencer marketing. Audiences are skeptical of one-time placements — they read them as "a brand paid this person to say this once." Repeated, long-term partnerships communicate a different message: "this creator genuinely uses this product."</p>
      <h2>4. Platform Diversification Is No Longer Optional</h2>
      <p>In 2021, you could run an influencer program almost entirely on Instagram and get solid results. That's no longer true. TikTok has established itself as a conversion platform. YouTube Shorts is increasingly competitive. Pinterest continues to punch above its weight for product categories like home, beauty, and fashion.</p>
      <h2>5. The Spreadsheet Era Is Ending</h2>
      <p>The operational complexity of modern influencer marketing — multi-platform tracking, content approval workflows, performance-linked compensation, long-term relationship management — has simply outgrown what spreadsheets can support. The shift toward dedicated influencer management platforms is accelerating, driven by cost and competitive disadvantage. The brands that figure this out in 2025 will have a compounding advantage going into 2026.</p>
    `,
  },
  "rejection-insights": {
    cat: "Platform Tips",
    title: "How to Use Instroom's Rejection Insights to Turn \"No\" Into Your Next Campaign Win",
    heroImg: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1400&q=85&fit=crop",
    heroAlt: "Team analyzing campaign pipeline data",
    author: "Marco Patel",
    authorInitials: "MP",
    authorColor: "#a855f7",
    date: "April 10, 2025",
    read: "5 min read",
    body: `
      <p>Most brands treat a declined partnership as a dead end. The creator said no, you move on, you find someone else. But in a well-structured influencer program, a "no" is one of the most valuable data points you can collect — if you actually capture and analyze it.</p>
      <p>Instroom tracks rejection reasons as a standard field in every creator pipeline. Here's how to use that data to systematically improve your outreach results.</p>
      <figure class="article-img"><img src="https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?w=1200&q=80&fit=crop" alt="Marketing team reviewing outreach data" loading="lazy"><figcaption>Every declined outreach contains a signal — the question is whether you're capturing it.</figcaption></figure>
      <h2>The Rejection Reasons That Actually Matter</h2>
      <ul>
        <li><strong>No creative freedom:</strong> Your brief was too scripted. Over-scripted content earns 30–40% lower engagement than creator-led posts. If this comes up more than once, your brief needs revision.</li>
        <li><strong>Budget mismatch:</strong> Your offer was below market rate. Adjust the fee, the deliverables, or the tier you're targeting.</li>
        <li><strong>Values mismatch:</strong> Your product doesn't align with the creator's personal brand. Your creator selection criteria need refinement.</li>
        <li><strong>Brand conflict:</strong> The creator has an exclusivity deal with a competitor. Flag and move on.</li>
        <li><strong>Fully booked:</strong> Timing issue, not a relationship issue. Add a follow-up reminder for next quarter.</li>
      </ul>
      <div class="callout"><p>Instroom stores rejection reasons per creator, per campaign. When you re-approach a creator months later, you can see why they said no last time and adjust your approach accordingly.</p></div>
      <h2>Tracking Rejection Patterns Across a Campaign</h2>
      <p>Individual rejections are informative. Patterns across a campaign are diagnostic. If 40% of your outreach comes back as "budget mismatch," you have a pricing strategy problem. If you're seeing consistent "values mismatch" responses, your creator targeting needs recalibration.</p>
      <h2>The Follow-Up Protocol</h2>
      <p>For creators who declined due to timing or budget, a structured follow-up process recovers a meaningful percentage of those relationships. Our data suggests that 20–25% of creators who decline an initial outreach will accept a re-approach in a subsequent campaign. The key is logging the decline and scheduling the follow-up at the time of rejection — not three months later when you've forgotten the context.</p>
      <h2>Turning No Into Your Outreach Benchmark</h2>
      <p>Over time, your rejection data becomes a benchmark for outreach quality. A program converting 40% of outreach into active partnerships is performing well above average. One converting 10% has either a targeting problem, a budget problem, or a brief problem — and the rejection breakdown tells you exactly which one. Treat every "no" as a data point. Log it. Analyze the patterns. Adjust.</p>
    `,
  },
  "product-seeding": {
    cat: "Strategy",
    title: "Product Seeding Done Right: How to Get Creators to Post Without Paying Them",
    heroImg: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1400&q=85&fit=crop",
    heroAlt: "Beautiful product packaging and unboxing experience",
    author: "Sara Reeves",
    authorInitials: "SR",
    authorColor: "linear-gradient(135deg,#1FAE5B,#0F6B3E)",
    date: "April 18, 2025",
    read: "6 min read",
    body: `
      <p>Product seeding — sending your product to creators without a formal paid partnership — is one of the most misunderstood tactics in influencer marketing. Done wrong, it's expensive gifting with zero return. Done right, it's one of the highest-ROI activities in your entire marketing stack.</p>
      <figure class="article-img"><img src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&q=80&fit=crop" alt="Thoughtfully packaged product ready for seeding" loading="lazy"><figcaption>The unboxing experience is part of the content. Presentation signals intent.</figcaption></figure>
      <h2>Why Most Seeding Programs Fail</h2>
      <p>The most common failure mode is scale without targeting. Brands mail their product to 500 creators hoping that 50 will post. The conversion rate is unpredictable, the content quality is variable, and the creators who do post are often doing it out of obligation rather than genuine enthusiasm — which shows in the content.</p>
      <div class="callout"><p>In Instroom, you can segment your creator database by category, previous engagement, and campaign history to identify your best seeding candidates. Starting from a curated list is far more efficient than cold outreach at scale.</p></div>
      <h2>Who to Seed</h2>
      <p>The highest-converting seeding targets share three characteristics: they already create content in your product's category, they've engaged with your brand or similar brands organically, and their audience profile matches your customer profile. You're not looking for the biggest account — you're looking for the most naturally aligned one.</p>
      <h2>What to Send (And How to Send It)</h2>
      <p>The unboxing experience is part of the content. Creators who receive a thoughtfully packaged product with a genuine, personalized note are significantly more likely to post than those who receive a plain shipping box with a form letter. A handwritten card that references something specific about the creator's content signals that you actually know who they are.</p>
      <h2>How to Frame the Ask</h2>
      <p>Don't make an ask. This sounds counterintuitive, but explicitly asking for a post in your seeding outreach reduces the organic quality of whatever content comes from it. Frame the package as a gift, tell them why you thought of them specifically, and make it genuinely no-strings-attached. The creators who love the product will post. The ones who don't won't.</p>
      <h2>The Follow-Up</h2>
      <p>A single low-pressure follow-up, sent two weeks after delivery, is appropriate. Keep it brief: check that they received it, offer to answer any product questions, and leave it at that. Track who posts and what they say. The creators whose seeded content performs well are your first call list for paid partnerships.</p>
    `,
  },
  "spreadsheet-vs-platform": {
    cat: "Industry",
    title: "Still Managing Influencer Campaigns in a Spreadsheet? Here's What It's Costing You",
    heroImg: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=1400&q=85&fit=crop",
    heroAlt: "Person working on spreadsheet and laptop",
    author: "Armand Manibo",
    authorInitials: "AM",
    authorColor: "#1FAE5B",
    date: "April 12, 2025",
    read: "7 min read",
    body: `
      <p>A spreadsheet feels free. You open one, you build a tracker, you share it with the team. There's no subscription, no onboarding, no learning curve. For a brand running one campaign with five creators, a spreadsheet is probably fine.</p>
      <p>But here's what happens when you scale: the spreadsheet that felt free starts costing you something you can't see on a balance sheet — hours, accuracy, and opportunities.</p>
      <figure class="article-img"><img src="https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1200&q=80&fit=crop" alt="Overwhelmed marketer with multiple spreadsheet tabs open" loading="lazy"><figcaption>If your campaign tracker has more than four tabs, it's already a problem.</figcaption></figure>
      <h2>The Hidden Hourly Cost</h2>
      <p>At Armful Media, before building Instroom, the team was managing 30 brands across individual campaign trackers. The time cost wasn't in the spreadsheet itself — it was in everything around it:</p>
      <ul>
        <li>Rebuilding the tracker structure for every new campaign</li>
        <li>Manually updating status fields after every email, call, and content approval</li>
        <li>Searching for the most recent version of a file after simultaneous edits</li>
        <li>Compiling client reports by copy-pasting from four separate tabs</li>
        <li>Onboarding a new team member by walking them through "the system" for two hours</li>
      </ul>
      <div class="callout"><p>When Armful Media migrated operations to Instroom, campaign setup time dropped from several hours to under 20 minutes. The pre-built pipeline structure eliminated the rebuild cycle entirely.</p></div>
      <h2>The Accuracy Problem</h2>
      <p>Spreadsheets break subtly. A formula that returns the wrong value because someone inserted a row. A status that didn't get updated. A creator listed twice under slightly different name spellings. These errors are invisible until they become a problem: you reach out to a creator you already rejected, you underpay based on stale rate data, you send a client report with the wrong conversion numbers.</p>
      <h2>The Opportunity Cost</h2>
      <p>Every hour your team spends managing the spreadsheet is an hour they're not spending on the things that actually move performance: creator research, relationship building, brief quality, post-campaign analysis. Teams that move to a purpose-built platform consistently report that they're able to run more campaigns with the same headcount — not because the platform does the work for them, but because it stops asking them to do administrative work that doesn't need to exist.</p>
      <h2>What "Free" Actually Costs</h2>
      <p>Instroom's Solo plan is $19 a month. If your current spreadsheet system is costing your team even two hours a week in overhead at any reasonable hourly rate, the math is straightforward. The question isn't whether a dedicated platform is worth the cost — it's whether you've been accurately accounting for what the spreadsheet is already costing you.</p>
    `,
  },
  "cac-reduction": {
    cat: "Growth",
    title: "How to Cut CAC by 30% Using Influencer Communities Instead of Paid Ads",
    heroImg: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=1400&q=85&fit=crop",
    heroAlt: "Growth metrics and financial performance chart",
    author: "Leila Osei",
    authorInitials: "LO",
    authorColor: "#f59e0b",
    date: "April 5, 2025",
    read: "8 min read",
    body: `
      <p>Customer acquisition cost is climbing. Meta CPMs are up, Google competition is tighter, and the easy DTC growth that ran on cheap paid social through 2020 and 2021 has become significantly more expensive to replicate. The brands holding their CAC flat — or actively reducing it — are increasingly doing it through influencer-led acquisition rather than paid ads.</p>
      <figure class="article-img"><img src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80&fit=crop" alt="Marketing team discussing community-driven growth strategy" loading="lazy"><figcaption>Community-driven acquisition works because trust, not targeting, drives conversion.</figcaption></figure>
      <h2>The Community Acquisition Model</h2>
      <p>Instead of broadcasting a message to a cold audience through paid social, you embed your brand into communities that already trust each other, through creators who are already trusted voices within those communities. A Meta ad shown to a cold audience converts at somewhere between 1–3%. A recommendation from a trusted creator within a niche community can convert at 5–12% on the same product, at a fraction of the CPM.</p>
      <div class="metric-row">
        <div class="metric-box"><div class="metric-box-num">1–3%</div><div class="metric-box-label">Typical cold paid social conversion rate</div></div>
        <div class="metric-box"><div class="metric-box-num">5–12%</div><div class="metric-box-label">Creator-community conversion rate</div></div>
        <div class="metric-box"><div class="metric-box-num">30%</div><div class="metric-box-label">Avg CAC reduction, community model</div></div>
      </div>
      <h2>Step 1: Map Your Community Landscape</h2>
      <p>Before identifying creators, identify the communities where your customer already lives. For a skincare brand, this might be specific subreddits, niche TikTok hashtag communities, or YouTube audiences around dermatology creators. The creator is the access point to the community — but the community is the target.</p>
      <h2>Step 2: Find the Trusted Voices</h2>
      <p>Community trust often lives with micro and nano creators — the people who are genuinely inside the community rather than observers of it. A 12K-follower account deeply embedded in a niche skincare community can drive more direct sales than a 200K general beauty creator with a broader, less engaged audience.</p>
      <div class="callout"><p>The most valuable community creators often have smaller followings than you'd expect. Instroom's discovery tools let you filter by category depth, not just follower count — so you find the right voice, not just the biggest one.</p></div>
      <h2>Step 3: Build Relationships, Not Transactions</h2>
      <p>Community-model acquisition works on repeated exposure over time, not a single post. The brands reducing their CAC most significantly are running structured ambassador programs: a roster of community-embedded creators, posting consistently over a quarter or longer, with performance-linked compensation that rewards actual conversion.</p>
      <h2>Step 4: Track ROAS Per Creator</h2>
      <p>Aggregate campaign ROAS hides the signal. In most community-model programs, 20–30% of the creator roster drives 70–80% of the sales. Identifying which creators are in that top tier — and doubling down on them — is where the CAC reduction compounds over time. You can't do this analysis without per-creator tracking. And you can't scale per-creator tracking without a platform built for it.</p>
    `,
  },
};

// ─── Logo SVG ─────────────────────────────────────────────────────────────────

const LogoSVG = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <circle cx="18" cy="18" r="16" stroke="#1FAE5B" strokeWidth="2.2" />
    <path d="M13 18c0-2.76 2.24-5 5-5s5 2.24 5 5-2.24 5-5 5" stroke="#1FAE5B" strokeWidth="2" strokeLinecap="round" />
    <circle cx="18" cy="13" r="1.4" fill="#1FAE5B" />
    <path d="M18 18l3.5 3.5" stroke="#1FAE5B" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

// ─── Shared article body styles injected once ─────────────────────────────────

const ARTICLE_BODY_STYLES = `
  .article-body h2 { font-family: 'Manrope', sans-serif; font-size: 22px; font-weight: 700; color: #1E1E1E; line-height: 1.3; letter-spacing: -0.3px; margin: 40px 0 16px; }
  .article-body h3 { font-family: 'Manrope', sans-serif; font-size: 17px; font-weight: 700; color: #1E1E1E; line-height: 1.35; letter-spacing: -0.2px; margin: 28px 0 12px; }
  .article-body p { font-size: 15px; color: #333; line-height: 1.75; margin-bottom: 20px; }
  .article-body p:first-child { font-size: 16.5px; color: #444; line-height: 1.7; }
  .article-body ul, .article-body ol { padding-left: 24px; margin-bottom: 20px; }
  .article-body li { font-size: 15px; color: #333; line-height: 1.7; margin-bottom: 8px; }
  .article-body strong { font-weight: 600; color: #1E1E1E; }
  .article-img { width: 100%; border-radius: 12px; margin: 28px 0; overflow: hidden; }
  .article-img img { width: 100%; height: 280px; object-fit: cover; display: block; }
  .article-img figcaption { font-size: 11px; color: #bbb; margin-top: 8px; text-align: center; font-style: italic; }
  .callout { background: #f0faf5; border-left: 3px solid #1FAE5B; border-radius: 0 10px 10px 0; padding: 18px 22px; margin: 28px 0; }
  .callout p { font-size: 14px; color: #0F6B3E; line-height: 1.65; margin: 0; font-weight: 500; }
  .metric-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 28px 0; }
  .metric-box { background: #f7f9f8; border: 0.5px solid #e5ece8; border-radius: 12px; padding: 20px 16px; text-align: center; }
  .metric-box-num { font-family: 'Manrope', sans-serif; font-size: 32px; font-weight: 800; color: #1FAE5B; line-height: 1; letter-spacing: -1px; margin-bottom: 6px; }
  .metric-box-label { font-size: 11px; color: #888; font-weight: 500; }
  .article-divider { border: none; border-top: 0.5px solid rgba(0,0,0,0.08); margin: 40px 0; }
  @media (max-width: 900px) { .metric-row { grid-template-columns: 1fr 1fr; } }
`;

// ─── Article View ─────────────────────────────────────────────────────────────

function ArticleView({
  art,
  onBack,
}: {
  art: Article;
  onBack: () => void;
}) {
  const ctaHtml = `
    <hr class="article-divider" />
    <div style="background:#0a1a0f;border-radius:14px;padding:36px;text-align:center;margin:48px 0 0;">
      <h3 style="font-family:'Manrope',sans-serif;font-size:22px;font-weight:700;color:#fff;margin-bottom:10px;letter-spacing:-0.3px;">Ready to run campaigns like this?</h3>
      <p style="font-size:14px;color:rgba(255,255,255,0.4);margin-bottom:24px;line-height:1.6;">Instroom gives you one workspace for every creator, every campaign, and every result. Start free — no credit card required.</p>
      <a href="/signup" style="font-family:'Inter',sans-serif;font-size:14px;font-weight:600;color:#fff;background:#1FAE5B;border-radius:8px;padding:10px 24px;text-decoration:none;display:inline-block;">Start free for 30 days</a>
    </div>
  `;

  return (
    <div style={{ background: "#fff", color: "#1E1E1E" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Manrope:wght@600;700;800&display=swap'); ${ARTICLE_BODY_STYLES}`}</style>
      <MainHeader />

      <div style={{ minHeight: "100vh" }}>
        {/* Hero */}
        <div style={{ position: "relative", height: 420, overflow: "hidden" }}>
          <img
            src={art.heroImg}
            alt={art.heroAlt}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "brightness(0.45)" }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to bottom, rgba(10,26,15,0.3) 0%, rgba(10,26,15,0.8) 100%)",
            display: "flex", alignItems: "flex-end",
          }}>
            <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 40px 48px", width: "100%" }}>
              <button
                onClick={onBack}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.5)",
                  cursor: "pointer", marginBottom: 20, transition: "color 0.15s",
                  border: "none", background: "none", fontFamily: "'Inter', sans-serif",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#1FAE5B")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
              >
                ← Back to Blog
              </button>
              <div style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#1FAE5B", marginBottom: 12 }}>
                {art.cat}
              </div>
              <h1 style={{
                fontFamily: "'Manrope', sans-serif", fontSize: "clamp(24px, 3.5vw, 38px)",
                fontWeight: 800, color: "#fff", lineHeight: 1.15, letterSpacing: "-0.8px", marginBottom: 16,
              }}>
                {art.title}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: art.authorColor, display: "flex", alignItems: "center",
                  justifyContent: "center", fontFamily: "'Manrope', sans-serif",
                  fontWeight: 700, fontSize: 11, color: "#fff", flexShrink: 0,
                }}>
                  {art.authorInitials}
                </div>
                <div>
                  <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600 }}>{art.author}</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{art.date}</div>
                </div>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", border: "0.5px solid rgba(255,255,255,0.15)", padding: "3px 10px", borderRadius: 100 }}>
                  {art.read}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "52px 40px 80px" }}>
          <div className="article-body" dangerouslySetInnerHTML={{ __html: art.body + ctaHtml }} />
        </div>
      </div>

      <MainFooter />
    </div>
  );
}

// ─── Index View ───────────────────────────────────────────────────────────────

const FILTERS = ["All Posts", "Strategy", "Creator Economy", "Analytics", "Platform Tips", "Case Studies"];

const GRID_CARDS = [
  {
    slug: "influencer-brief" as ArticleSlug,
    img: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=700&q=80&fit=crop",
    alt: "Creator filming content with smartphone",
    badgeBg: "rgba(31,174,91,0.9)",
    cat: "Strategy",
    title: "Why Your Influencer Brief Is Killing Engagement (And How to Fix It)",
    desc: "Over-scripted briefs tank authentic performance by 30–40%. Here's how to write briefs that spark creativity without losing brand control.",
    authorBg: "#1FAE5B",
    authorInitials: "JK",
    authorName: "Jake Kim",
    read: "6 min",
  },
  {
    slug: "micro-vs-macro" as ArticleSlug,
    img: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=700&q=80&fit=crop",
    alt: "Data charts and analytics on laptop screen",
    badgeBg: "rgba(59,130,246,0.9)",
    cat: "Analytics",
    title: "Micro vs. Macro Influencers: A Data-Backed Decision Framework for DTC Brands",
    desc: "We analyzed 800+ campaigns on Instroom to find when each tier wins — and when it doesn't.",
    authorBg: "#3b82f6",
    authorInitials: "AM",
    authorName: "Anika Mehta",
    read: "9 min",
  },
  {
    slug: "creator-economy-2025" as ArticleSlug,
    img: "https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=700&q=80&fit=crop",
    alt: "Content creator recording a video",
    badgeBg: "rgba(245,158,11,0.9)",
    cat: "Trends",
    title: "Creator Economy 2025: The Trends Reshaping Influencer Marketing This Year",
    desc: "From UGC-first strategies to performance-linked creator pay, the rules are rewriting themselves.",
    authorBg: "#f59e0b",
    authorInitials: "LO",
    authorName: "Leila Osei",
    read: "7 min",
  },
  {
    slug: "rejection-insights" as ArticleSlug,
    img: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=700&q=80&fit=crop",
    alt: "Team reviewing campaign data on screen",
    badgeBg: "rgba(168,85,247,0.9)",
    cat: "Platform",
    title: "How to Use Instroom's Rejection Insights to Turn \"No\" Into Your Next Campaign Win",
    desc: "Every declined partnership contains a signal. Decode rejection data and improve outreach hit rate by up to 40%.",
    authorBg: "#a855f7",
    authorInitials: "MP",
    authorName: "Marco Patel",
    read: "5 min",
  },
];

const LIST_ARTICLES = [
  {
    slug: "product-seeding" as ArticleSlug,
    img: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=200&q=80&fit=crop",
    alt: "Product packaging and unboxing",
    title: "Product Seeding Done Right: How to Get Creators to Post Without Paying Them",
    desc: "The gifting playbook that top DTC brands use to generate organic coverage and build long-term creator relationships.",
    cat: "Strategy",
    date: "April 18, 2025 · 6 min read",
  },
  {
    slug: "spreadsheet-vs-platform" as ArticleSlug,
    img: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=200&q=80&fit=crop",
    alt: "Person working on spreadsheet laptop",
    title: "Still Managing Influencer Campaigns in a Spreadsheet? Here's What It's Costing You",
    desc: "Spreadsheets feel free. But the hidden cost in lost hours, missed follow-ups, and broken workflows tells a different story.",
    cat: "Industry",
    date: "April 12, 2025 · 7 min read",
  },
  {
    slug: "cac-reduction" as ArticleSlug,
    img: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=200&q=80&fit=crop",
    alt: "Growth chart showing cost reduction",
    title: "How to Cut CAC by 30% Using Influencer Communities Instead of Paid Ads",
    desc: "A step-by-step breakdown of the community-driven acquisition model that's making traditional paid channels look expensive.",
    cat: "Growth",
    date: "April 5, 2025 · 8 min read",
  },
];

const TRENDING = [
  { slug: "roi-metrics" as ArticleSlug, title: "The 5 Metrics That Predict Campaign ROI", meta: "4.2k reads · Strategy" },
  { slug: "micro-vs-macro" as ArticleSlug, title: "Micro vs Macro: A Data-Backed Framework", meta: "3.1k reads · Analytics" },
  { slug: "cac-reduction" as ArticleSlug, title: "How to Cut CAC by 30% With Influencer Communities", meta: "2.8k reads · Growth" },
  { slug: "creator-economy-2025" as ArticleSlug, title: "Creator Economy Trends Reshaping 2025", meta: "2.4k reads · Trends" },
];

const TOPICS = ["Strategy", "Analytics", "Creator Economy", "DTC Brands", "ROI", "Platform Tips", "Product Seeding", "UGC", "Case Studies", "Outreach", "CAC Reduction"];

function IndexView({ onSelectArticle }: { onSelectArticle: (slug: ArticleSlug) => void }) {
  const [activeFilter, setActiveFilter] = useState("All Posts");
  const [activePage, setActivePage] = useState(1);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [emailError, setEmailError] = useState(false);

  function handleSubscribe() {
    if (email.includes("@")) {
      setSubscribed(true);
      setEmailError(false);
    } else {
      setEmailError(true);
      setTimeout(() => setEmailError(false), 1000);
    }
  }

  return (
    <div style={{ background: "#fff", color: "#1E1E1E" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Manrope:wght@600;700;800&display=swap');`}</style>
      <MainHeader />

      {/* Hero */}
      <section style={{ background: "#0a1a0f", padding: "72px 40px 56px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -100, right: -80, width: 440, height: 440, background: "radial-gradient(circle, rgba(31,174,91,0.16) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 1120, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#1FAE5B", marginBottom: 20 }}>
            <span style={{ display: "inline-block", width: 18, height: 1.5, background: "#1FAE5B" }} />
            The Instroom Blog
          </div>
          <h1 style={{ fontFamily: "'Manrope', sans-serif", fontSize: "clamp(30px, 4vw, 50px)", fontWeight: 800, color: "#fff", lineHeight: 1.1, letterSpacing: "-1px", maxWidth: 600, marginBottom: 16 }}>
            Influencer marketing,<br />
            <em style={{ fontStyle: "normal", color: "#1FAE5B" }}>made measurable.</em>
          </h1>
          <p style={{ fontSize: 14.5, color: "rgba(255,255,255,0.45)", maxWidth: 460, lineHeight: 1.7, marginBottom: 36 }}>
            Actionable insights, data-driven strategies, and creator economy trends — so you stop guessing and start growing.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                style={{
                  padding: "6px 16px", borderRadius: 100, fontFamily: "'Inter', sans-serif",
                  fontSize: 12, fontWeight: 500, cursor: "pointer", border: "0.5px solid",
                  borderColor: activeFilter === f ? "#1FAE5B" : "rgba(255,255,255,0.12)",
                  color: activeFilter === f ? "#fff" : "rgba(255,255,255,0.45)",
                  background: activeFilter === f ? "#1FAE5B" : "transparent",
                  transition: "all 0.15s",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Blog Wrap */}
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "52px 40px 80px", display: "grid", gridTemplateColumns: "1fr 296px", gap: 52, alignItems: "start" }}>
        <main>
          {/* Featured label */}
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", marginBottom: 18, paddingBottom: 10, borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
            Featured
          </p>

          {/* Featured Card */}
          <article
            onClick={() => onSelectArticle("roi-metrics")}
            style={{
              border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 14, overflow: "hidden",
              marginBottom: 48, display: "grid", gridTemplateColumns: "1fr 1fr",
              minHeight: 340, cursor: "pointer", transition: "box-shadow 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.12)";
              const img = e.currentTarget.querySelector(".feat-img") as HTMLImageElement;
              if (img) img.style.transform = "scale(1.04)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
              const img = e.currentTarget.querySelector(".feat-img") as HTMLImageElement;
              if (img) img.style.transform = "scale(1)";
            }}
          >
            <div style={{ position: "relative", overflow: "hidden" }}>
              <img
                className="feat-img"
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80&fit=crop"
                alt="Analytics dashboard showing marketing metrics"
                loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "brightness(0.75)", transition: "transform 0.4s" }}
              />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(10,26,15,0.6) 0%, rgba(15,107,62,0.3) 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 60, fontWeight: 800, color: "#fff", lineHeight: 1, letterSpacing: "-2px", textShadow: "0 2px 20px rgba(0,0,0,0.4)" }}>3.8×</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.65)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 6 }}>Average ROI Uplift</div>
                </div>
              </div>
              <span style={{ position: "absolute", top: 14, left: 14, background: "#1FAE5B", color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 100, zIndex: 2 }}>
                ⭐ Editor&apos;s Pick
              </span>
            </div>
            <div style={{ padding: "36px 32px", background: "#fff", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#1FAE5B", marginBottom: 12 }}>Strategy</p>
              <h2 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 21, fontWeight: 700, color: "#1E1E1E", lineHeight: 1.3, letterSpacing: "-0.3px", marginBottom: 12 }}>
                The 5 Metrics That Actually Predict Influencer Campaign ROI
              </h2>
              <p style={{ fontSize: 13, color: "#888", lineHeight: 1.65, marginBottom: 24 }}>
                Most brands track follower count and likes. The brands winning in 2025 track engagement velocity, audience overlap score, and content save rate. Here&apos;s what separates noise from signal.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 10, color: "#fff", background: "linear-gradient(135deg,#1FAE5B,#0F6B3E)", flexShrink: 0 }}>SR</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1E1E1E" }}>Sara Reeves</div>
                  <div style={{ fontSize: 11, color: "#888" }}>April 28, 2025</div>
                </div>
                <span style={{ fontSize: 11, color: "#888", border: "0.5px solid #e5ece8", padding: "3px 10px", borderRadius: 100 }}>8 min read</span>
              </div>
            </div>
          </article>

          {/* Latest Articles label */}
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", marginBottom: 18, paddingBottom: 10, borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
            Latest Articles
          </p>

          {/* Grid Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 48 }}>
            {GRID_CARDS.map((card) => (
              <article
                key={card.slug}
                onClick={() => onSelectArticle(card.slug)}
                style={{ border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 12, overflow: "hidden", background: "#fff", cursor: "pointer", transition: "box-shadow 0.2s, border-color 0.2s, transform 0.2s" }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.boxShadow = "0 6px 24px rgba(0,0,0,0.09)";
                  el.style.borderColor = "rgba(31,174,91,0.3)";
                  el.style.transform = "translateY(-2px)";
                  const img = el.querySelector(".card-img") as HTMLImageElement;
                  if (img) img.style.transform = "scale(1.04)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.boxShadow = "none";
                  el.style.borderColor = "rgba(0,0,0,0.08)";
                  el.style.transform = "translateY(0)";
                  const img = el.querySelector(".card-img") as HTMLImageElement;
                  if (img) img.style.transform = "scale(1)";
                }}
              >
                <div style={{ height: 180, position: "relative", overflow: "hidden" }}>
                  <img className="card-img" src={card.img} alt={card.alt} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.4s", filter: "brightness(0.88)" }} />
                  <span style={{ position: "absolute", top: 10, left: 10, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 100, zIndex: 1, background: card.badgeBg, color: "#fff" }}>
                    {card.cat}
                  </span>
                </div>
                <div style={{ padding: "16px 18px 18px" }}>
                  <h3 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 700, color: "#1E1E1E", lineHeight: 1.35, letterSpacing: "-0.2px", marginBottom: 7 }}>{card.title}</h3>
                  <p style={{ fontSize: 12, color: "#888", lineHeight: 1.6, marginBottom: 14 }}>{card.desc}</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 8, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", background: card.authorBg }}>{card.authorInitials}</div>
                      <span style={{ fontSize: 11, color: "#888", fontWeight: 500 }}>{card.authorName}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "#bbb" }}>{card.read}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* More From the Blog label */}
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", marginBottom: 18, paddingBottom: 10, borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
            More From the Blog
          </p>

          {/* List Articles */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {LIST_ARTICLES.map((item) => (
              <article
                key={item.slug}
                onClick={() => onSelectArticle(item.slug)}
                style={{ display: "flex", gap: 14, padding: 16, border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 12, cursor: "pointer", transition: "all 0.15s", background: "#fff", alignItems: "flex-start" }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "rgba(31,174,91,0.3)";
                  el.style.background = "#f0faf5";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "rgba(0,0,0,0.08)";
                  el.style.background = "#fff";
                }}
              >
                <div style={{ width: 80, height: 80, borderRadius: 10, flexShrink: 0, overflow: "hidden" }}>
                  <img src={item.img} alt={item.alt} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "brightness(0.9)" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13.5, fontWeight: 700, color: "#1E1E1E", lineHeight: 1.35, marginBottom: 4 }}>{item.title}</h4>
                  <p style={{ fontSize: 12, color: "#888", lineHeight: 1.55, marginBottom: 8 }}>{item.desc}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#1FAE5B" }}>{item.cat}</span>
                    <span style={{ fontSize: 11, color: "#bbb" }}>{item.date}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 32, paddingTop: 24, borderTop: "0.5px solid rgba(0,0,0,0.08)" }}>
            {["←", "1", "2", "3", "…", "9", "→"].map((label, i) => (
              <button
                key={i}
                onClick={() => { if (!["←", "→", "…"].includes(label)) setActivePage(Number(label)); }}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: "0.5px solid",
                  borderColor: activePage === Number(label) ? "#1FAE5B" : "rgba(0,0,0,0.12)",
                  background: activePage === Number(label) ? "#1FAE5B" : "#fff",
                  fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 500,
                  color: activePage === Number(label) ? "#fff" : "#888",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </main>

        {/* Sidebar */}
        <aside style={{ position: "sticky", top: 84 }}>
          {/* Newsletter */}
          <div style={{ border: "0.5px solid transparent", borderRadius: 12, padding: 22, marginBottom: 18, background: "#0a1a0f" }}>
            <h3 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13.5, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Get the Weekly Briefing</h3>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.65, marginBottom: 16 }}>
              Influencer marketing insights, creator trends, and Instroom tips — every Tuesday. No fluff.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  background: "rgba(255,255,255,0.06)", border: `0.5px solid ${emailError ? "#ef4444" : "rgba(255,255,255,0.12)"}`,
                  borderRadius: 8, padding: "9px 13px", color: "#fff",
                  fontFamily: "'Inter', sans-serif", fontSize: 13, outline: "none", transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#1FAE5B")}
                onBlur={(e) => (e.currentTarget.style.borderColor = emailError ? "#ef4444" : "rgba(255,255,255,0.12)")}
              />
              <Button
                onClick={handleSubscribe}
                style={{ background: subscribed ? "#0F6B3E" : "#1FAE5B", color: "#fff", border: "none", borderRadius: 8, padding: 9, fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}
              >
                {subscribed ? "✓ You're in!" : "Subscribe free →"}
              </Button>
            </div>
          </div>

          {/* Stat card */}
          <div style={{ background: "#f0faf5", border: "0.5px solid rgba(31,174,91,0.2)", borderRadius: 12, padding: 22, textAlign: "center", marginBottom: 18 }}>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 42, fontWeight: 800, color: "#1FAE5B", lineHeight: 1, letterSpacing: "-2px", marginBottom: 6 }}>3.8×</div>
            <p style={{ fontSize: 12, color: "#888", lineHeight: 1.55, marginBottom: 14 }}>average ROI uplift for brands using Instroom vs. manual influencer management</p>
            <Link href="/signup" style={{ display: "inline-block", background: "#1FAE5B", color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 600, padding: "7px 16px", borderRadius: 8 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#0F6B3E")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#1FAE5B")}
            >
              See the data
            </Link>
          </div>

          {/* Trending */}
          <div style={{ border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 22, marginBottom: 18, background: "#fff" }}>
            <h3 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13.5, fontWeight: 700, color: "#1E1E1E", marginBottom: 16 }}>Trending This Week</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {TRENDING.map((item, i) => (
                <div
                  key={item.slug}
                  onClick={() => onSelectArticle(item.slug)}
                  style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}
                  onMouseEnter={(e) => { const h4 = e.currentTarget.querySelector("h4") as HTMLElement; if (h4) h4.style.color = "#1FAE5B"; }}
                  onMouseLeave={(e) => { const h4 = e.currentTarget.querySelector("h4") as HTMLElement; if (h4) h4.style.color = "#1E1E1E"; }}
                >
                  <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 18, fontWeight: 800, color: "#e8ede9", lineHeight: 1, flexShrink: 0, width: 22 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h4 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 700, color: "#1E1E1E", lineHeight: 1.35, marginBottom: 2, transition: "color 0.15s" }}>{item.title}</h4>
                    <span style={{ fontSize: 10, color: "#bbb" }}>{item.meta}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Topics */}
          <div style={{ border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 22, marginBottom: 18, background: "#fff" }}>
            <h3 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13.5, fontWeight: 700, color: "#1E1E1E", marginBottom: 16 }}>Browse by Topic</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TOPICS.map((topic) => (
                <span
                  key={topic}
                  style={{ padding: "5px 11px", background: "#f7f9f8", border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 100, fontSize: 11, fontWeight: 500, color: "#1E1E1E", cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = "#1FAE5B"; el.style.borderColor = "#1FAE5B"; el.style.color = "#fff"; }}
                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = "#f7f9f8"; el.style.borderColor = "rgba(0,0,0,0.08)"; el.style.color = "#1E1E1E"; }}
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <MainFooter />
    </div>
  );
}

// ─── Root Export ──────────────────────────────────────────────────────────────

export function BlogPage() {
  const [activeSlug, setActiveSlug] = useState<ArticleSlug | null>(null);

  function handleSelectArticle(slug: ArticleSlug) {
    setActiveSlug(slug);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    setActiveSlug(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (activeSlug) {
    return <ArticleView art={articles[activeSlug]} onBack={handleBack} />;
  }

  return <IndexView onSelectArticle={handleSelectArticle} />;
}