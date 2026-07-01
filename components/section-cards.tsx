"use client"

import { IconTrendingDown, IconTrendingUp, IconUsers, IconMail,  IconChartLine } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function SectionCards() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 xl:grid-cols-2 2xl:grid-cols-4">

      {/* TOTAL INFLUENCERS */}
      <Card className="border border-[#0F6B3E]/10 bg-white shadow-sm">
        <CardHeader>
          <CardDescription>Total Influencers</CardDescription>

          <CardTitle className="text-2xl font-semibold flex items-center gap-2">
            <IconUsers className="text-[#1FAE5B]" />
            1,248
          </CardTitle>

          <CardAction>
            <Badge className="bg-[#1FAE5B]/10 text-[#0F6B3E] border-[#1FAE5B]/30">
              <IconTrendingUp className="size-4" />
              +8.2%
            </Badge>
          </CardAction>
        </CardHeader>

        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="flex gap-2 font-medium text-[#0F6B3E]">
            Influencer database growing
            <IconTrendingUp className="size-4" />
          </div>

          <div className="text-muted-foreground">
            Compared to last month
          </div>
        </CardFooter>
      </Card>

      {/* OUTREACH SENT */}
      <Card className="border border-[#0F6B3E]/10 bg-white shadow-sm">
        <CardHeader>
          <CardDescription>Outreach Sent</CardDescription>

          <CardTitle className="text-2xl font-semibold flex items-center gap-2">
            <IconMail className="text-[#1FAE5B]" />
            324
          </CardTitle>

          <CardAction>
            <Badge className="bg-[#1FAE5B]/10 text-[#0F6B3E] border-[#1FAE5B]/30">
              <IconTrendingUp className="size-4" />
              +14%
            </Badge>
          </CardAction>
        </CardHeader>

        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="flex gap-2 font-medium text-[#0F6B3E]">
            Outreach performance improving
            <IconTrendingUp className="size-4" />
          </div>

          <div className="text-muted-foreground">
            Campaign outreach activity
          </div>
        </CardFooter>
      </Card>

      {/* ACTIVE COLLABORATIONS */}
      <Card className="border border-[#0F6B3E]/10 bg-white shadow-sm">
        <CardHeader>
          <CardDescription>Active Collaborations</CardDescription>

          <CardTitle className="text-2xl font-semibold flex items-center gap-2">
            <IconUsers className="text-[#1FAE5B]" />
            87
          </CardTitle>

          <CardAction>
            <Badge className="bg-red-100 text-red-600 border-red-200">
              <IconTrendingDown className="size-4" />
              -3%
            </Badge>
          </CardAction>
        </CardHeader>

        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="flex gap-2 font-medium text-red-600">
            Slight drop this week
            <IconTrendingDown className="size-4" />
          </div>

          <div className="text-muted-foreground">
            Monitor campaign progress
          </div>
        </CardFooter>
      </Card>

      {/* CAMPAIGN GROWTH */}
      <Card className="border border-[#0F6B3E]/10 bg-white shadow-sm">
        <CardHeader>
          <CardDescription>Campaign Growth</CardDescription>

          <CardTitle className="text-2xl font-semibold flex items-center gap-2">
            <IconChartLine className="text-[#1FAE5B]" />
            12.4%
          </CardTitle>

          <CardAction>
            <Badge className="bg-[#1FAE5B]/10 text-[#0F6B3E] border-[#1FAE5B]/30">
              <IconTrendingUp className="size-4" />
              +4.5%
            </Badge>
          </CardAction>
        </CardHeader>

        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="flex gap-2 font-medium text-[#0F6B3E]">
            Campaign engagement rising
            <IconTrendingUp className="size-4" />
          </div>

          <div className="text-muted-foreground">
            Influencer marketing performance
          </div>
        </CardFooter>
      </Card>

    </div>
  )
}