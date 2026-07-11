import { MainHeader } from "@/components/shared/main-header"
import { MainFooter } from "@/components/shared/main-footer"
import { TikTokDownloaderHero } from "@/components/tools-page/tiktok-downloader-hero"
import { TikTokDownloaderFeatures } from "@/components/tools-page/tiktok-downloader-features"

export const metadata = {
  title: "TikTok Video Downloader Without Watermark | Instroom",
  description: "Download TikTok videos without watermark in HD, free and instantly. No login required.",
}

export default function TikTokDownloaderPage() {
  return (
    <div className="font-sans bg-white text-zinc-900">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800;900&display=swap');`}</style>
      <MainHeader />
      <TikTokDownloaderHero />
      <TikTokDownloaderFeatures />
      <MainFooter />
    </div>
  )
}
