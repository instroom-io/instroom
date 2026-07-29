import { redirect } from "next/navigation"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { isAdminSession } from "@/lib/admin-auth"
import { AdminSidebar } from "@/components/admin-sidebar"

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
    <div className="min-h-svh flex bg-[#F7F9F8]">
      <AdminSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="max-w-[1400px] mx-auto p-6 sm:p-8">{children}</div>
      </main>
    </div>
  )
}
