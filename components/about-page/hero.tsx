import Image from "next/image";

export function AboutHero() {
    return (
        <section style={{ paddingTop: "100px", background: "#F7F9F8" }}>
            <div className="max-w-6xl mx-auto px-8 py-20 grid grid-cols-2 gap-20 items-center">
                {/* Left Content */}
                <div>
                    <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-2 mb-6">
                        <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
                            Our Story
                        </span>
                    </div>

                    <h1
                        style={{
                            fontFamily: "'Manrope', sans-serif",
                            fontSize: "52px",
                            fontWeight: 900,
                            lineHeight: 1.08,
                            letterSpacing: "-0.03em",
                        }}
                        className="text-zinc-900 mb-6"
                    >
                        Built from the{" "}
                        <span style={{ color: "#1FAE5B" }}>
                            inside
                        </span>{" "}
                        of influencer marketing.
                    </h1>

                    <p className="text-lg text-zinc-600 mb-8 leading-relaxed max-w-md">
                        Instroom was born from 200+ campaigns, 100,000+ influencers, and
                        the hard-won lessons of building what the industry actually needed —
                        not another bloated platform.
                    </p>

                    <div className="flex gap-12">
                        <div>
                            <div
                                style={{
                                    fontFamily: "'Manrope', sans-serif",
                                    fontSize: "26px",
                                    fontWeight: 800,
                                    color: "#1E1E1E",
                                }}
                            >
                                200<span style={{ color: "#1FAE5B" }}>+</span>
                            </div>
                            <div className="text-xs text-zinc-600 font-medium mt-1">
                                Campaigns run
                            </div>
                        </div>

                        <div>
                            <div
                                style={{
                                    fontFamily: "'Manrope', sans-serif",
                                    fontSize: "26px",
                                    fontWeight: 800,
                                    color: "#1E1E1E",
                                }}
                            >
                                100K<span style={{ color: "#1FAE5B" }}>+</span>
                            </div>
                            <div className="text-xs text-zinc-600 font-medium mt-1">
                                Influencers managed
                            </div>
                        </div>

                        <div>
                            <div
                                style={{
                                    fontFamily: "'Manrope', sans-serif",
                                    fontSize: "26px",
                                    fontWeight: 800,
                                    color: "#1E1E1E",
                                }}
                            >
                                $10M<span style={{ color: "#1FAE5B" }}>+</span>
                            </div>
                            <div className="text-xs text-zinc-600 font-medium mt-1">
                                Revenue generated
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative flex justify-center translate-x-10">
                    {/* Decorative Circles */}
                    <div className="absolute -left-5 bottom-0 w-16 h-16 rounded-full bg-emerald-100 opacity-70" />
                    <div className="absolute -right-4 top-8 w-20 h-20 rounded-full bg-emerald-100 opacity-70" />

                    {/* Team Card */}
                    <div className="relative bg-white rounded-[28px] overflow-hidden shadow-xl w-[720px]">
                        {/* Placeholder */}
                        <div className="h-[280px] bg-gradient-to-br from-zinc-50 to-zinc-100 flex flex-col items-center justify-center border-b border-zinc-200">
                            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                                <svg
                                    className="w-10 h-10 text-emerald-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M17 20h5V4H2v16h5m10 0v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2m12 0H7m10-11a4 4 0 11-8 0 4 4 0 018 0z"
                                    />
                                </svg>
                            </div>

                            <h3 className="text-2xl font-bold text-zinc-800 mb-2">
                                Team Photo Coming Soon
                            </h3>
                        </div>

                        {/* Bottom Info */}
                        <div className="flex items-center justify-between px-7 py-5">
                            <div>
                                <h3 className="font-bold text-zinc-900 text-xl">
                                    Armful Media
                                </h3>
                                <p className="text-sm text-zinc-500">
                                    The agency behind Instroom
                                </p>
                            </div>

                            <span className="bg-emerald-100 text-emerald-700 text-sm font-semibold px-5 py-2 rounded-full">
                                5+ Years
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}