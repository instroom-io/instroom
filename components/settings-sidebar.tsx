"use client"

import { usePathname, useRouter } from "next/navigation"

type SettingsItem = {
  key: string
  label: string
  href: string
  icon: React.ReactNode
}

type SettingsSection = {
  group: string
  items: SettingsItem[]
}

const settingsSections: SettingsSection[] = [
  {
    group: "Account",
    items: [
      {
        key: "profile",
        label: "Profile",
        href: "/dashboard/settings",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width={14} height={14}>
            <circle cx="8" cy="5" r="3" />
            <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          </svg>
        ),
      },
      {
        key: "security",
        label: "Security",
        href: "/dashboard/settings/security",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width={14} height={14}>
            <rect x="4" y="7" width="8" height="7" rx="1.5" />
            <path d="M5 7V5a3 3 0 016 0v2" />
          </svg>
        ),
      },
      {
        key: "notifications",
        label: "Notifications",
        href: "/dashboard/settings/notifications",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width={14} height={14}>
            <path d="M8 2a5 5 0 00-5 5v3l-1 2h12l-1-2V7a5 5 0 00-5-5z" />
            <path d="M6.5 13a1.5 1.5 0 003 0" />
          </svg>
        ),
      },
    ],
  },
  {
    group: "Workspace",
    items: [
      {
        key: "branding",
        label: "Branding",
        href: "/dashboard/settings/branding",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width={14} height={14}>
            <circle cx="8" cy="8" r="6" />
            <circle cx="8" cy="8" r="2" />
          </svg>
        ),
      },
      {
        key: "collaborators",
        label: "Team & Collaborators",
        href: "/dashboard/settings/collaborators",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width={14} height={14}>
            <circle cx="6" cy="5" r="2.5" />
            <path d="M1 14c0-2.8 2.2-5 5-5" />
            <circle cx="11" cy="5" r="2.5" />
            <path d="M15 14c0-2.8-2.2-5-5-5" />
          </svg>
        ),
      },
      {
        key: "integrations",
        label: "Integrations",
        href: "/dashboard/settings/integrations",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width={14} height={14}>
            <path d="M6.5 9.5l3-3" />
            <path d="M7 4.5L8 3.5a2.5 2.5 0 113.5 3.5l-1 1" />
            <path d="M9 11.5L8 12.5a2.5 2.5 0 11-3.5-3.5l1-1" />
          </svg>
        ),
      },
    ],
  },
  {
    group: "Plan",
    items: [
      {
        key: "billing",
        label: "Billing & Subscription",
        href: "/dashboard/settings/billing",
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width={14} height={14}>
            <rect x="1" y="4" width="14" height="9" rx="2" />
            <path d="M1 8h14" />
          </svg>
        ),
      },
    ],
  },
]

export function SettingsSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const cleanPath = pathname?.split("?")[0] ?? ""

  return (
    <div
      className="flex flex-col flex-shrink-0 overflow-y-auto"
      style={{
        width: 220,
        background: "#ffffff",
        borderRight: "0.5px solid rgba(0,0,0,0.08)",
        alignSelf: "stretch",
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px 20px 12px" }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#1e1e1e", margin: 0 }}>
          Settings
        </p>
      </div>

      {/* Nav */}
      {settingsSections.map((section, si) => (
        <div key={section.group} style={{ marginBottom: 6 }}>
          {si > 0 && (
            <div style={{ height: "0.5px", background: "rgba(0,0,0,0.07)", margin: "8px 20px" }} />
          )}
          <p
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#aaa",
              padding: "8px 20px 4px",
              margin: 0,
            }}
          >
            {section.group}
          </p>

          {section.items.map((item) => {
            const isActive =
              item.key === "profile"
                ? cleanPath === item.href
                : cleanPath === item.href || cleanPath.startsWith(item.href + "/")

            return (
              <div
                key={item.key}
                onClick={() => router.push(item.href)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && router.push(item.href)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 20px",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#1fae5b" : "#555",
                  background: isActive ? "#f0faf5" : "transparent",
                  borderLeft: isActive ? "2px solid #1fae5b" : "2px solid transparent",
                  transition: "background 0.12s, color 0.12s",
                  userSelect: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    ;(e.currentTarget as HTMLDivElement).style.background = "#f7f9f8"
                    ;(e.currentTarget as HTMLDivElement).style.color = "#1e1e1e"
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    ;(e.currentTarget as HTMLDivElement).style.background = "transparent"
                    ;(e.currentTarget as HTMLDivElement).style.color = "#555"
                  }
                }}
              >
                <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.6, display: "flex", alignItems: "center" }}>
                  {item.icon}
                </span>
                {item.label}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}