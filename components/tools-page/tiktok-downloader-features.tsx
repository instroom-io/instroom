const FEATURES = [
  {
    title: "Clean & High-Quality Downloads",
    desc: "Our tool lets you download TikTok videos without watermarks, ensuring your content is professional and ready for use in your next marketing initiative.",
    icon: (
      <path d="M5 3v4M3 5h4M12 14v4M10 16h4" stroke="#1FAE5B" strokeWidth="1.6" strokeLinecap="round" />
    ),
  },
  {
    title: "Easy-to-Use Interface",
    desc: "Forget complicated processes! Simply paste the TikTok video link, and we'll give you the watermark-free version in just a few seconds.",
    icon: (
      <path d="M6 3h6a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM6.5 6h5M6.5 9h5M6.5 12h3" stroke="#1FAE5B" strokeWidth="1.5" strokeLinecap="round" />
    ),
  },
  {
    title: "No Pop-up Ads",
    desc: "Unlike other downloaders that bombard you with pop-up ads, our tool provides a seamless, ad-free experience, so you can get your videos without distractions.",
    icon: (
      <path d="M3 5h12v8H8l-3 3v-3H3V5z" stroke="#1FAE5B" strokeWidth="1.5" strokeLinejoin="round" />
    ),
  },
  {
    title: "Works With Re-uploads & Direct Recordings",
    desc: "Influencers may record directly on TikTok or download their own videos. If they reupload it, our downloader still works perfectly to remove the watermark, giving you clean videos every time.",
    icon: (
      <path d="M9 3a6 6 0 1 1-5.6 8M3 3v4h4" stroke="#1FAE5B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    title: "Fast and Convenient",
    desc: "No need to wait for influencers to send raw footage. Our downloader allows you to get the final video quickly, free from watermarks, and ready to use for your marketing efforts.",
    icon: (
      <path d="M4 3h8l-1 6h3l-6 8 1-6H6l-2 8" stroke="#1FAE5B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
]

export function TikTokDownloaderFeatures() {
  return (
    <section style={{ background: "#F7F9F8", padding: "72px 24px" }}>
      <div className="max-w-6xl mx-auto">
        <h2
          className="text-center mb-12"
          style={{ fontFamily: "'Manrope', sans-serif", fontSize: "30px", fontWeight: 800, letterSpacing: "-0.02em", color: "#1E1E1E" }}
        >
          Why Use Our <span style={{ color: "#1FAE5B" }}>TikTok Video Downloader</span>?
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white"
              style={{ borderRadius: 16, padding: "22px 18px", border: "1px solid #eef1ef", boxShadow: "0 4px 16px rgba(0,0,0,0.03)" }}
            >
              <div
                className="flex items-center justify-center mb-4"
                style={{ width: 36, height: 36, borderRadius: 10, background: "#E8F9EE" }}
              >
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                  {f.icon}
                </svg>
              </div>
              <h3 style={{ fontFamily: "'Manrope', sans-serif", fontSize: "0.9375rem", fontWeight: 700, color: "#1E1E1E", marginBottom: 8 }}>
                {f.title}
              </h3>
              <p style={{ fontSize: "0.75rem", color: "#6b7280", lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
