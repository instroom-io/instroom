"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { usePathname } from "next/navigation"
import { useState, useRef, useEffect, type ReactNode } from "react"

function DropdownHero({
  href,
  icon,
  title,
  desc,
  pills,
}: {
  href: string
  icon: ReactNode
  title: string
  desc: string
  pills: { label: string; soon?: boolean }[]
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "linear-gradient(135deg, #0F6B3E 0%, #1FAE5B 100%)",
        borderRadius: 12,
        padding: "18px 22px",
        marginBottom: 16,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* decorative circles */}
        <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, background: "rgba(255,255,255,0.07)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", bottom: -20, right: 60, width: 80, height: 80, background: "rgba(255,255,255,0.05)", borderRadius: "50%" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
          <div style={{ width: 44, height: 44, background: "rgba(255,255,255,0.18)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {icon}
          </div>
          <div>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>{title}</div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>{desc}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 420, position: "relative" }}>
          {pills.map(({ label, soon }) => (
            <span key={label} style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 10px",
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 99,
              fontSize: 11.5, fontWeight: 500,
              color: "rgba(255,255,255,0.95)",
              whiteSpace: "nowrap",
            }}>
              {!soon && (
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="rgba(255,255,255,0.8)" strokeWidth="1.4"/>
                  <path d="M4 6l1.5 1.5L8 4" stroke="rgba(255,255,255,0.8)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {label}
              {soon && (
                <span style={{ fontSize: 9.5, background: "rgba(244,183,64,0.85)", color: "#1E1E1E", borderRadius: 4, padding: "1px 5px", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase" }}>
                  Soon
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </Link>
  )
}

function ProductDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLLIElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setOpen(true)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 120)
  }

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [])

  return (
    <li ref={ref} style={{ position: "relative" }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "1rem",
          fontWeight: 500,
          color: "var(--charcoal)",
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: 0,
        }}
      >
        Products
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 12px)",
          left: "50%",
          transform: "translateX(-50%)",
          width: 760,
          background: "#ffffff",
          borderRadius: 16,
          boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
          padding: 20,
          zIndex: 200,
        }}>

          <DropdownHero
            href="/#pricing"
            title="Instroom"
            desc="Influencer relationship management, built for scale"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2"/>
                <circle cx="12" cy="8" r="1.5" fill="white"/>
                <path d="M11 11h1v6h1" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            }
            pills={[
              { label: "Analytics" },
              { label: "Brand Partners" },
              { label: "Gmail Integration" },
              { label: "Influencer Discovery", soon: true },
              { label: "Outlook Integration", soon: true },
            ]}
          />

          {/* Standalone tools */}
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 8, padding: "0 4px" }}>
            Standalone Tools
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {/* Post Tracker */}
            <a href="https://posttracker.instroom.io" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 10, border: "1.5px solid #f0f0f0", background: "#fafafa", cursor: "pointer", transition: "border-color 0.15s, background 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1FAE5B"; (e.currentTarget as HTMLDivElement).style.background = "#f0faf4" }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#f0f0f0"; (e.currentTarget as HTMLDivElement).style.background = "#fafafa" }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#e8f8ef", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <rect x="2" y="2" width="14" height="14" rx="3" stroke="#1FAE5B" strokeWidth="1.6"/>
                    <path d="M5 9l2.5 2.5L13 6" stroke="#1FAE5B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1E1E1E", display: "flex", alignItems: "center", gap: 6 }}>
                    Post Tracker
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, letterSpacing: "0.04em", textTransform: "uppercase", background: "#f0faf4", color: "#0F6B3E", border: "1px solid #c5ead5" }}>Standalone</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>Track posts, download content, auto-save to Drive</div>
                </div>
              </div>
            </a>

            {/* Chrome Extension */}
            <a href="https://chromewebstore.google.com/detail/instroomio/ehgceomekjhamiakclkpgadphbenlmmj" style={{ textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 10, border: "1.5px solid #f0f0f0", background: "#fafafa", cursor: "pointer" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1FAE5B"; (e.currentTarget as HTMLDivElement).style.background = "#f0faf4" }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#f0f0f0"; (e.currentTarget as HTMLDivElement).style.background = "#fafafa" }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#e8f3fa", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <circle cx="9" cy="9" r="7" stroke="#2C8EC4" strokeWidth="1.6"/>
                    <circle cx="9" cy="9" r="3" fill="#2C8EC4" fillOpacity="0.15" stroke="#2C8EC4" strokeWidth="1.4"/>
                    <path d="M9 2v7M15.5 5.5L9 9M15.5 12.5L9 9" stroke="#2C8EC4" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1E1E1E", display: "flex", alignItems: "center", gap: 6 }}>
                    Chrome Extension
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, letterSpacing: "0.04em", textTransform: "uppercase", background: "#f0faf4", color: "#0F6B3E", border: "1px solid #c5ead5" }}>Standalone</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>Capture influencer data while browsing Instagram & TikTok</div>
                </div>
              </div>
            </a>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid #f0f0f0", margin: "14px 0" }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px 2px" }}>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>The complete influencer management stack</span>
            <Link href="/features" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "#1FAE5B", textDecoration: "none" }}>
              Explore all features
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8M8 4l3 3-3 3" stroke="#1FAE5B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>

        </div>
      )}
    </li>
  )
}

function DropdownCard({
  href,
  external,
  icon,
  iconBg,
  title,
  desc,
  badge,
  soon,
  onClick,
}: {
  href: string
  external?: boolean
  icon: ReactNode
  iconBg: string
  title: string
  desc: string
  badge?: string
  soon?: boolean
  onClick?: () => void
}) {
  const inner = (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "13px 14px",
        borderRadius: 10,
        border: "1.5px solid #f0f0f0",
        background: "#fafafa",
        cursor: soon ? "default" : "pointer",
        opacity: soon ? 0.55 : 1,
        transition: "border-color 0.15s, background 0.15s",
        height: "100%",
      }}
      onMouseEnter={soon ? undefined : (e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = "#1FAE5B"
        ;(e.currentTarget as HTMLDivElement).style.background = "#f0faf4"
      }}
      onMouseLeave={soon ? undefined : (e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = "#f0f0f0"
        ;(e.currentTarget as HTMLDivElement).style.background = "#fafafa"
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 8, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1E1E1E", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {title}
          {badge && (
            <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, letterSpacing: "0.04em", textTransform: "uppercase", background: "#f0faf4", color: "#0F6B3E", border: "1px solid #c5ead5" }}>{badge}</span>
          )}
          {soon && (
            <span style={{ fontSize: 9.5, background: "#f0f0f0", color: "#6b7280", borderRadius: 4, padding: "1px 5px", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase" }}>Soon</span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  )

  if (soon) return inner

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }} onClick={onClick}>
        {inner}
      </a>
    )
  }

  return (
    <Link href={href} style={{ textDecoration: "none" }} onClick={onClick}>
      {inner}
    </Link>
  )
}

function NavDropdownShell({
  label,
  width,
  children,
}: {
  label: string
  width: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLLIElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setOpen(true)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 120)
  }

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [])

  return (
    <li ref={ref} style={{ position: "relative" }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "1rem",
          fontWeight: 500,
          color: "var(--charcoal)",
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: 0,
        }}
      >
        {label}
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 12px)",
          left: "50%",
          transform: "translateX(-50%)",
          width,
          background: "#ffffff",
          borderRadius: 16,
          boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
          padding: 20,
          zIndex: 200,
        }}>
          {children}
        </div>
      )}
    </li>
  )
}

function SolutionsDropdown() {
  return (
    <NavDropdownShell label="Solutions" width={760}>
      <DropdownHero
        href="/solutions"
        title="Solutions"
        desc="Instroom adapts to how you work — solo, agency, or in-house"
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2"/>
            <path d="M15 9l-2 5-5 2 2-5z" fill="white" fillOpacity="0.9"/>
          </svg>
        }
        pills={[
          { label: "Freelancers" },
          { label: "Agencies" },
          { label: "DTC Brands" },
        ]}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
        <DropdownCard
          href="/solutions?type=freelancer"
          iconBg="#e8f8ef"
          title="Freelancers"
          desc="Build a portfolio, land recurring clients"
          icon={
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="6" r="3" stroke="#1FAE5B" strokeWidth="1.6" />
              <path d="M3.5 15c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="#1FAE5B" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          }
        />
        <DropdownCard
          href="/solutions?type=agency"
          iconBg="#e8f3fa"
          title="Agency Owners"
          desc="Scale campaigns across all your clients"
          icon={
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="3" y="3" width="8" height="12" rx="1" stroke="#2C8EC4" strokeWidth="1.6" />
              <path d="M11 15V7l4 2v6" stroke="#2C8EC4" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M5.5 6h1M5.5 9h1M5.5 12h1" stroke="#2C8EC4" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          }
        />
        <DropdownCard
          href="/solutions?type=dtc"
          iconBg="#fdf1e6"
          title="DTC Founders"
          desc="Own your influencer program end-to-end"
          icon={
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 6l1-3h10l1 3" stroke="#E08D3C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 6v8a1 1 0 001 1h10a1 1 0 001-1V6" stroke="#E08D3C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 6a2 2 0 004 0 2 2 0 004 0 2 2 0 004 0" stroke="#E08D3C" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          }
        />
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #f0f0f0", margin: "0 0 14px" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px" }}>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>Not sure which fits? See it all in one place</span>
        <Link href="/solutions" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "#1FAE5B", textDecoration: "none" }}>
          Explore all solutions
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7h8M8 4l3 3-3 3" stroke="#1FAE5B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </NavDropdownShell>
  )
}

function ResourcesDropdown() {
  return (
    <NavDropdownShell label="Resources" width={760}>
      <DropdownHero
        href="/blog"
        title="Resources"
        desc="Guides, tools, and answers to help you grow smarter"
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M4 5.5C4 4.67 4.67 4 5.5 4H12v16H5.5A1.5 1.5 0 014 18.5v-13z" stroke="white" strokeWidth="1.6" strokeLinejoin="round"/>
            <path d="M20 5.5c0-.83-.67-1.5-1.5-1.5H12v16h6.5c.83 0 1.5-.67 1.5-1.5v-13z" stroke="white" strokeWidth="1.6" strokeLinejoin="round"/>
          </svg>
        }
        pills={[
          { label: "Blog" },
          { label: "FAQs" },
          { label: "Free Tools" },
        ]}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
        <DropdownCard
          href="/blog"
          iconBg="#e8f3fa"
          title="Blog"
          desc="Influencer marketing insights"
          icon={
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="3" y="2" width="12" height="14" rx="1.5" stroke="#2C8EC4" strokeWidth="1.6" />
              <path d="M6 6h6M6 9h6M6 12h4" stroke="#2C8EC4" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          }
        />
        <DropdownCard
          href="/#faq"
          iconBg="#f3f0fd"
          title="FAQs"
          desc="Answers to common questions"
          icon={
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="7" stroke="#8b5cf6" strokeWidth="1.6" />
              <path d="M7 7a2 2 0 013.5 1.3c0 1.3-1.8 1.4-1.8 2.7" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="9" cy="12.5" r="0.9" fill="#8b5cf6" />
            </svg>
          }
        />
        <DropdownCard
          href="/demo"
          iconBg="#e8f8ef"
          title="Demo"
          desc="See Instroom in action"
          icon={
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="7" stroke="#1FAE5B" strokeWidth="1.6" />
              <path d="M7.5 6.5l4 2.5-4 2.5z" fill="#1FAE5B" />
            </svg>
          }
        />
      </div>

      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 8, padding: "0 4px" }}>
        Free Tools
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <DropdownCard
          href="/tools/tiktok-downloader"
          iconBg="#e8f8ef"
          title="TikTok Downloader"
          desc="Save TikTok videos in HD, no watermark"
          badge="Free"
          icon={
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 3v8M9 11l-3-3M9 11l3-3" stroke="#1FAE5B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 13v1a2 2 0 002 2h8a2 2 0 002-2v-1" stroke="#1FAE5B" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          }
        />
        <DropdownCard
          href="#"
          iconBg="#e8f3fa"
          title="Transcribe to Text"
          desc="Turn videos into text captions instantly"
          soon
          icon={
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="7" y="2" width="4" height="8" rx="2" stroke="#2C8EC4" strokeWidth="1.6" />
              <path d="M4.5 8.5a4.5 4.5 0 009 0" stroke="#2C8EC4" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M9 13v2.5M6.5 15.5h5" stroke="#2C8EC4" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
        />
        <DropdownCard
          href="#"
          iconBg="#f3f0fd"
          title="Rate Calculator"
          desc="Estimate fair rates for sponsored content"
          soon
          icon={
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="4" y="2" width="10" height="14" rx="1.5" stroke="#8b5cf6" strokeWidth="1.6" />
              <path d="M6.5 5.5h5M6.5 8.5h1.5M10 8.5h1.5M6.5 11.5h1.5M10 11.5h1.5" stroke="#8b5cf6" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          }
        />
      </div>
    </NavDropdownShell>
  )
}

export function MainHeader() {
  const pathname = usePathname()

  const navLinkStyle = (href: string) => ({
    textDecoration: "none",
    color: pathname === href ? "var(--green)" : "var(--charcoal)",
    fontWeight: pathname === href ? 600 : 500,
  })

  return (
    <nav
      className="nav"
      style={{
        width: "100%",
        background: "#F4F7F5",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
        <div
          className="nav-inner"
          style={{
            display: "flex",
            alignItems: "center",
            paddingTop: "14px",
            paddingBottom: "14px",
            paddingLeft: "60px",
            paddingRight: "16px",
            width: "100%",
            gap: 24,
          }}
        >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", marginRight: 80 }}>
          <Image src="/images/instroomLogo.png" alt="Instroom logo" width={36} height={36} />
          <span style={{ fontSize: "1.125rem", fontWeight: "bold", color: "var(--charcoal)" }}>Instroom</span>
        </Link>

        <ul
          className="nav-links"
          style={{
            display: "flex",
            gap: 32,
            alignItems: "center",
            listStyle: "none",
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            paddingRight: 0,
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          <ProductDropdown />
          <SolutionsDropdown />
          <li>
            <Link href="/landing-nav/features" style={navLinkStyle("/landing-nav/features")}>
              What's Inside
            </Link>
          </li>
          <li>
            <Link href="/about" style={navLinkStyle("/about")}>
              About Us
            </Link>
          </li>
          <li>
            <Link href="/landing-nav/pricing" style={navLinkStyle("/landing-nav/pricing")}>
              Pricing
            </Link>
          </li>
          <ResourcesDropdown />
        </ul>

        <div className="nav-cta" style={{ display: "flex", gap: 18, alignItems: "center", marginLeft: "auto" }}>
          <a href="#" style={{ fontSize: "0.9375rem", textDecoration: "none", color: "var(--charcoal)" }}>
            Book a demo
          </a>
          <Link href="/login" style={{ fontSize: "0.9375rem", fontWeight: "500", textDecoration: "none", color: "var(--charcoal)" }}>
            Log in
          </Link>
          <Link href="/signup">
            <Button className="bg-gradient-to-r from-[#0F6B3E] to-[#1FAE5B] text-white font-semibold hover:from-[#0a5a2f] hover:to-[#158a48] shadow-lg shadow-emerald-500/25">
              Start free
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  )
}