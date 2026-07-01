import { SettingsSidebar } from "@/components/settings-sidebar"
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="flex flex-row"
      style={{
        position: "absolute",
        inset: 0,
        top: "var(--header-height, 48px)",
        zIndex: 1,
      }}
    >
      <SettingsSidebar />
      <main
        className="flex-1 overflow-y-auto"
        style={{ background: "#f7f9f8" }}
      >
        {children}
      </main>
    </div>
  )
}