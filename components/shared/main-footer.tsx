"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { IconBrandFacebook, IconBrandInstagram, IconBrandTiktok, IconBrandLinkedin } from "@tabler/icons-react"

const FREE_TOOLS = [
  { title: "TikTok Downloader Without Watermark", href: "/tools/tiktok-downloader", soon: false },
  { title: "Transcribe TikTok & Instagram to Text", soon: true },
  { title: "Influencer Rate Calculator", soon: true },
]

const SOCIAL_LINKS = [
  { label: "Facebook", href: "https://www.facebook.com/instroom.io/", Icon: IconBrandFacebook },
  { label: "Instagram", href: "https://www.instagram.com/instroom.io/", Icon: IconBrandInstagram },
  { label: "TikTok", href: "https://www.tiktok.com/@instroom.io", Icon: IconBrandTiktok },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/instroom/", Icon: IconBrandLinkedin },
]

function splitFirstTwoWords(title: string) {
  const words = title.split(" ")
  return [words.slice(0, 2).join(" "), words.slice(2).join(" ")]
}

function FooterInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const solutionType = searchParams.get("type")
  const isOnSolutions = pathname === "/solutions"

  const getSolutionColor = (type: string) => {
    if (!isOnSolutions) return "text-zinc-400"
    if (!solutionType) return "text-emerald-500"
    return solutionType === type ? "text-emerald-500" : "text-zinc-400"
  }

  return (
    <footer className="bg-zinc-950 text-zinc-400 pt-10 pb-16 px-8 border-t border-zinc-800">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:justify-between gap-8 sm:gap-10 mb-12">
          <div className="lg:max-w-[220px]">
            <Image
              src="/images/instroomLogoWhiteFooter.png"
              alt="Instroom logo"
              width={180}
              height={67}
              style={{ marginBottom: "12px" }}
            />
            <p className="text-sm text-zinc-500">The influencer marketing workspace for eCommerce brands and agencies.</p>
            <div className="flex items-center gap-3 mt-5">
              {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                <Link
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-[#1FAE5B] hover:border-[#1FAE5B] hover:text-white transition"
                >
                  <Icon size={17} stroke={1.75} />
                </Link>
              ))}
            </div>
          </div>
          <div className="lg:ml-10">
            <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-4">Products</h4>
            <ul className="space-y-4 text-sm">
              <li><Link href="/features" className="hover:text-white transition">Instroom Platform</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition">Pricing</Link></li>
              <li><Link href="https://chromewebstore.google.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Chrome Extension</Link></li>
              <li><Link href="https://posttracker.instroom.io" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Post Tracker</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-4">Solutions</h4>
            <ul className="space-y-4 text-sm">
              <li><Link href="/solutions?type=freelancer" className={`${getSolutionColor("freelancer")} hover:text-white transition`}>For Freelancers</Link></li>
              <li><Link href="/solutions?type=agency" className={`${getSolutionColor("agency")} hover:text-white transition`}>For Agency Owners</Link></li>
              <li><Link href="/solutions?type=dtc" className={`${getSolutionColor("dtc")} hover:text-white transition`}>For DTC Founders</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-4">Resources</h4>
            <ul className="space-y-4 text-sm">
              <li><Link href="/blog" className="hover:text-white transition">Blog</Link></li>
              <li><Link href="/#faq" className="hover:text-white transition">FAQs</Link></li>
              <li><Link href="/demo" className="hover:text-white transition">Demo</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-4">Free Tools</h4>
            <ul className="space-y-4 text-sm">
              {FREE_TOOLS.map((tool) => {
                const [firstTwo, rest] = splitFirstTwoWords(tool.title)
                return tool.soon ? (
                  <li key={tool.title}>
                    {firstTwo}
                    <br />
                    {rest}
                    <br />
                    <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wide bg-zinc-800 text-zinc-500 rounded px-1.5 py-0.5">
                      Soon
                    </span>
                  </li>
                ) : (
                  <li key={tool.title}>
                    <Link href={tool.href!} className="hover:text-white transition">
                      {firstTwo}
                      <br />
                      {rest}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-4">Company</h4>
            <ul className="space-y-4 text-sm">
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
    <Suspense fallback={<footer className="bg-zinc-950 text-zinc-400 pt-10 pb-16 px-8 border-t border-zinc-800" />}>
      <FooterInner />
    </Suspense>
  )
}
