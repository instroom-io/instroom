"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useState, useRef, useEffect } from "react"
import { FreeToolsTooltip } from "./free-tools-tooltip"

function FooterInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const solutionType = searchParams.get("type")
  const isOnSolutions = pathname === "/solutions"
  const [showFreeTools, setShowFreeTools] = useState(false)
  const freeToolsRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    if (!showFreeTools) return
    function handleClickOutside(e: MouseEvent) {
      if (freeToolsRef.current && !freeToolsRef.current.contains(e.target as Node)) {
        setShowFreeTools(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showFreeTools])

  const getSolutionColor = (type: string) => {
    if (!isOnSolutions) return "text-zinc-400"
    if (!solutionType) return "text-emerald-500"
    return solutionType === type ? "text-emerald-500" : "text-zinc-400"
  }

  return (
    <footer className="bg-zinc-950 text-zinc-400 py-16 px-8 border-t border-zinc-800">
      <div className="max-w-6xl mx-auto">
        <div className="grid gap-16 mb-12" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" }}>
          <div>
            <Image
              src="/images/instroomLogoWhite.png"
              alt="Instroom logo"
              width={120}
              height={120}
              style={{ marginBottom: "12px" }}
            />
            <p className="text-sm text-zinc-500">The influencer marketing workspace for eCommerce brands and agencies.</p>
          </div>
          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-4">Products</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/features" className="hover:text-white transition">Instroom Platform</Link></li>
              <li><Link href="https://chromewebstore.google.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Chrome Extension</Link></li>
              <li><Link href="https://posttracker.instroom.io" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Post Tracker</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-4">Solutions</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/solutions?type=freelancer" className={`${getSolutionColor("freelancer")} hover:text-white transition`}>For Freelancers</Link></li>
              <li><Link href="/solutions?type=agency" className={`${getSolutionColor("agency")} hover:text-white transition`}>For Agency Owners</Link></li>
              <li><Link href="/solutions?type=dtc" className={`${getSolutionColor("dtc")} hover:text-white transition`}>For DTC Founders</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-4">Resources</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/blog" className="hover:text-white transition">Blog</Link></li>
              <li><Link href="/#faq" className="hover:text-white transition">FAQs</Link></li>
              <li><Link href="/demo" className="hover:text-white transition">Demo</Link></li>
              <li><Link href="/features" className="hover:text-white transition">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition">Pricing</Link></li>
              <li ref={freeToolsRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setShowFreeTools((v) => !v)}
                  className="hover:text-white transition bg-transparent border-none p-0 cursor-pointer text-left"
                  style={{ font: "inherit", color: "inherit" }}
                >
                  Free Tools
                </button>
                {showFreeTools && <FreeToolsTooltip onClose={() => setShowFreeTools(false)} />}
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-4">Company</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/about" className="hover:text-white transition">About</Link></li>
              <li><Link href="#" className="hover:text-white transition">Contact</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-zinc-800 pt-8 flex justify-between text-sm text-zinc-500">
          <p>&copy; 2026 Instroom. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/terms-of-service" className="hover:text-white transition">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
            <Link href="/refund" className="hover:text-white transition">Refund Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

export function MainFooter() {
  return (
    <Suspense fallback={<footer className="bg-zinc-950 text-zinc-400 py-16 px-8 border-t border-zinc-800" />}>
      <FooterInner />
    </Suspense>
  )
}
