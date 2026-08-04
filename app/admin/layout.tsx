import { redirect } from "next/navigation"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { isAdminSession } from "@/lib/admin-auth"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

// Server-side gate — belt-and-suspenders alongside middleware.ts. Even if a
// request somehow reaches here without going through middleware (e.g. a
// misconfigured matcher in the future), this still blocks non-admins.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }
  if (!isAdminSession(session)) {
    redirect("/dashboard")
  }

  return (
    // Same shell contract as app/dashboard/layout.tsx — identical sidebar
    // width and header height variables, so both areas line up pixel-for-pixel.
    // `sidebar-shell` (app/globals.css) carries the responsive rail widths and
    // the off-canvas drawer rules — shared with the dashboard layout.
    <SidebarProvider
      className="sidebar-shell"
      style={{
        "--header-height": "calc(var(--spacing) * 12)",
      } as React.CSSProperties}
    >
      <AdminSidebar variant="inset" />
      <SidebarInset className="bg-[#F7F9F8]">
        <AdminHeader />
        {/* min-w-0 lets wide tables scroll inside their own container rather
            than being clipped, which the old overflow-x-hidden did. */}
        <div className="flex flex-1 flex-col min-w-0">
          <div className="w-full max-w-[1400px] mx-auto p-4 sm:p-6 md:p-8">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
