import { MainHeader } from "@/components/shared/main-header"
import { MainFooter } from "@/components/shared/main-footer"
import { AboutHero } from "@/components/about-page/hero"
import { AboutStory } from "@/components/about-page/story"
import { AboutMission } from "@/components/about-page/mission"
import { AboutVision } from "@/components/about-page/vision"
import { AboutValues } from "@/components/about-page/values"
import { AboutTeam } from "@/components/about-page/team"
import { AboutStats } from "@/components/about-page/stats"
import { AboutCTA } from "@/components/about-page/cta"

export default function AboutPage() {
  return (
    <div className="font-sans bg-white text-zinc-900">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Caveat:wght@600;700&display=swap');`}</style>
      <MainHeader />
      <AboutHero />
      <AboutStory />
      <AboutMission />
      <AboutVision />
      <AboutValues />
      <AboutTeam />
      <AboutStats />
      <AboutCTA />
      <MainFooter />
    </div>
  )
}