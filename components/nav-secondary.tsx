"use client"

import * as React from "react"
import { type Icon } from "@tabler/icons-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavSecondary({
  items,
  brandId,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: Icon
  }[]
  brandId?: string | null
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const buildUrl = (baseUrl: string) => {
    if (!brandId) return baseUrl
    const separator = baseUrl.includes("?") ? "&" : "?"
    return `${baseUrl}${separator}brandId=${brandId}`
  }

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <a href={buildUrl(item.url)}>
                  <item.icon />
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
