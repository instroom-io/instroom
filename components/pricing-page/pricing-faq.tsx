"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import styles from "./pricing-faq.module.css"

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: "How does the influencer limit work?",
    a: "Your plan sets how many influencers you can add to your list. Basic includes a one-time allotment, while Solo and Team refresh every month — you can add new influencers up to your plan's limit each month. Every time you add a creator, we automatically fill in their engagement rate, follower count, email, and location. Tip: don't delete creators just to free up space — you'll lose their history and risk reaching out to the same people twice.",
  },
  {
    q: "Is the Basic plan really free?",
    a: "Yes — free forever, not a trial. Basic covers one workspace and a one-time list of influencers, with the full pipeline and tracking toolkit, no credit card required. Upgrade to Solo or Team whenever you need to add more; nothing expires.",
  },
  {
    q: 'What are "creator insights"?',
    a: "When you add an influencer, Instroom automatically pulls their engagement rate, follower count, email, and location into their profile — so you're not hunting for it by hand. It's included on every plan, up to your plan's influencer limit. One caveat: email and location show up only when a creator has them publicly available, so some profiles may come up without them.",
  },
  {
    q: "What are the optional power tools?",
    a: "Post Tracker automatically monitors posts by hashtag or mention and saves the content to Google Drive — an opt-in add-on, coming soon. Discovery, for finding new creators, is also on the way. Neither is required to run Instroom.",
  },
  {
    q: "Do you charge per seat?",
    a: "No. Every plan includes unlimited seats, so you can invite your whole team and your clients without paying more per person. Role-based access keeps everyone in the right lane.",
  },
  {
    q: "Can I get a refund?",
    a: (
      <>
        New subscribers can request a full refund within 7 days of their first charge. After that, subscriptions
        are non-refundable for the current period, but you can cancel anytime and keep access until the period
        ends. See our <Link href="/refund">refund policy</Link> for the full details.
      </>
    ),
  },
]

export function PricingFaq() {
  const [expanded, setExpanded] = useState<number | null>(null)

  return (
    <section className={styles.faq}>
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <h2>Pricing questions, answered</h2>
        </div>
        <div className={styles.faqList}>
          {FAQS.map((faq, index) => (
            <div key={index} className={`${styles.faqItem} ${expanded === index ? styles.open : ""}`}>
              <button className={styles.faqQ} onClick={() => setExpanded(expanded === index ? null : index)}>
                <span>{faq.q}</span>
                <span className={styles.faqQIcon}>+</span>
              </button>
              {expanded === index && <div className={styles.faqA}>{faq.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
