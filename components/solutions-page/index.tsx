"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { MainHeader } from "@/components/shared/main-header"
import { MainFooter } from "@/components/shared/main-footer"
import { GLOBAL_STYLES } from "./styles"
import type { PageId } from "./types"
import { Hub } from "./hub"
import { Freelancer } from "./freelancer"
import { Agency } from "./agency"
import { Dtc } from "./dtc"

export function SolutionsPage() {
  const searchParams = useSearchParams()
  const [currentPage, setCurrentPage] = useState<PageId>("hub")

  useEffect(() => {
    const type = searchParams.get("type")
    if (type === "freelancer" || type === "agency" || type === "dtc") {
      setCurrentPage(type)
    }
  }, [searchParams])

  function navigate(page: PageId) {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function goBack() {
    navigate("hub")
  }

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", background: "var(--bg)", color: "var(--ink)" }}>
      <style>{GLOBAL_STYLES}</style>
      <MainHeader />

      {currentPage === "hub" && <Hub onNavigate={navigate} />}
      {currentPage === "freelancer" && <Freelancer onBack={goBack} />}
      {currentPage === "agency" && <Agency onBack={goBack} />}
      {currentPage === "dtc" && <Dtc onBack={goBack} />}

      <MainFooter />
    </div>
  )
}