import { Suspense } from "react"
import { SolutionsPage } from "@/components/solutions-page"

export default function Page() {
  return (
    <Suspense>
      <SolutionsPage />
    </Suspense>
  )
}