"use client"

import { useRouter, usePathname } from "next/navigation"
import { type Icon } from "@tabler/icons-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
  brandId,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
  }[]
  brandId?: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()

  const buildUrl = (baseUrl: string) => {
    if (!brandId) return baseUrl
    const separator = baseUrl.includes("?") ? "&" : "?"
    return `${baseUrl}${separator}brandId=${brandId}`
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">

        <SidebarMenu>
          {items.map((item) => {
            const isActive = pathname === item.url

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  onClick={() => router.push(buildUrl(item.url))}
                  className={`
                    flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors
                    ${
                      isActive
                        ? "bg-[#1FAE5B] text-white font-medium"
                        : "text-[#F7F9F8] hover:bg-white/10"
                    }
                  `}
                >
                  {item.icon && <item.icon className="h-4 w-4" />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>

      </SidebarGroupContent>
    </SidebarGroup>
  )
}