import { SettingsSidebar } from "@/components/settings-sidebar"

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // Desktop (md+) keeps the two-pane shell: a fixed region below the header
    // with independently scrolling nav and content panes. Unchanged.
    //
    // Phones drop out of it. `position: absolute; inset: 0` pinned settings to
    // the viewport, so content could never grow with the document — you
    // scrolled inside a short inner box while the section nav permanently ate
    // the top of it. That's what made these pages feel cramped and endless.
    // On phones it's now ordinary document flow: the page scrolls as one and
    // the nav sticks instead of occupying fixed height.
    <div className="flex min-h-0 flex-col md:absolute md:inset-0 md:top-(--header-height) md:z-[1] md:flex-row">
      <SettingsSidebar />
      <main className="min-w-0 flex-1 bg-[#f7f9f8] pb-[max(1.5rem,env(safe-area-inset-bottom))] md:overflow-y-auto md:pb-0">
        {children}
      </main>
    </div>
  )
}
