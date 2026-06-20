export const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Manrope:wght@400;600;700;800;900&display=swap');

  :root {
    --green: #1FAE5B;
    --green-dark: #178a47;
    --green-light: #f0faf5;
    --green-mid: #d6f0e3;
    --ink: #1E1E1E;
    --ink2: #444;
    --ink3: #888;
    --border: rgba(0,0,0,0.09);
    --white: #fff;
    --bg: #f7f9f8;
    --radius: 12px;
  }

  /* Hub cards */
  .hub-card { background: var(--bg); border: 0.5px solid var(--border); border-radius: 16px; padding: 28px; cursor: pointer; text-decoration: none; transition: all 0.2s; position: relative; overflow: hidden; display: block; }
  .hub-card::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, var(--green-light), transparent 60%); opacity: 0; transition: opacity 0.2s; }
  .hub-card:hover { border-color: var(--green); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(31,174,91,0.12); }
  .hub-card:hover::before { opacity: 1; }
  .hub-card:hover .hub-card-arrow { opacity: 1; }
  .hub-card:hover .hub-card-photo-wrap img { transform: scale(1.04); }

  .hub-card-photo-wrap { position: relative; z-index: 1; border-radius: 10px; overflow: hidden; margin-bottom: 20px; height: 160px; }
  .hub-card-photo-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.4s ease; }
  .hub-card-photo-wrap::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.25)); }

  .hub-card-title { font-size: 17px; font-weight: 700; color: var(--ink); margin-bottom: 6px; position: relative; z-index: 1; }
  .hub-card-desc { font-size: 13px; color: var(--ink2); line-height: 1.5; position: relative; z-index: 1; }
  .hub-card-arrow { font-size: 13px; color: var(--green); margin-top: 14px; display: flex; align-items: center; gap: 4px; font-weight: 600; position: relative; z-index: 1; opacity: 0; transition: opacity 0.2s; }

  /* Pain photo banner */
  .pain-photo-banner { width: 100%; height: 260px; border-radius: 16px; margin-bottom: 40px; position: relative; overflow: hidden; }
  .pain-photo-banner img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .pain-photo-banner::after { content: ''; position: absolute; inset: 0; border-radius: 16px; background: linear-gradient(to right, rgba(31,174,91,0.08), transparent); }

  /* Help rows */
  .help-row { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; padding: 52px 0; border-bottom: 0.5px solid var(--border); }
  .help-row:last-child { border-bottom: none; }
  .help-row.reverse .help-text { order: 2; }
  .help-row.reverse .help-visual { order: 1; }

  /* Bullet check SVG */
  .help-bullet-dot { width: 18px; height: 18px; border-radius: 6px; background: var(--green-light); border: 0.5px solid var(--green-mid); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
  .help-bullet-dot svg { width: 10px; height: 10px; }

  /* Mock UI elements */
  .mock-bar { height: 8px; border-radius: 4px; background: var(--green-mid); }
  .mock-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #fff; border-radius: 10px; border: 0.5px solid var(--border); }
  .mock-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--green-mid); flex-shrink: 0; }
  .mock-lines { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .mock-line { height: 7px; border-radius: 3px; background: var(--bg); }
  .mock-badge { font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 6px; }
  .mock-kpi-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .mock-kpi { background: #fff; border: 0.5px solid var(--border); border-radius: 10px; padding: 12px; text-align: center; }
  .mock-kpi-val { font-size: 18px; font-weight: 700; color: var(--ink); }
  .mock-kpi-lbl { font-size: 10px; color: var(--ink3); margin-top: 2px; }

  /* Features grid */
  .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 48px; }
  .feature-card { background: #fff; border: 0.5px solid var(--border); border-radius: 14px; padding: 24px; }

  /* Animations */
  @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  .fade-up { animation: fadeUp 0.5s ease forwards; }
  .delay-1 { animation-delay: 0.1s; opacity: 0; }
  .delay-2 { animation-delay: 0.2s; opacity: 0; }
  .delay-3 { animation-delay: 0.3s; opacity: 0; }

  /* Sol-hero eyebrow pill — matches landing page */
  .sol-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(31,174,91,0.1);
    border: 1px solid rgba(31,174,91,0.28);
    border-radius: 100px;
    padding: 5px 14px 5px 10px;
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #0F6B3E;
    margin-bottom: 28px;
    width: fit-content;
  }
  .sol-eyebrow-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #1FAE5B;
    flex-shrink: 0;
    animation: heroPulse 1.6s ease-in-out infinite;
  }
  @keyframes heroPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.35; transform: scale(0.7); }
  }

  /* Responsive */
  @media (max-width: 900px) {
    .hub-cards-grid, .pains-grid, .features-grid { grid-template-columns: 1fr 1fr !important; }
    .help-row { grid-template-columns: 1fr !important; }
    .help-row.reverse .help-text, .help-row.reverse .help-visual { order: unset !important; }
    .sol-hero-grid { grid-template-columns: 1fr !important; }
    .mock-kpi-row { grid-template-columns: 1fr 1fr !important; }
  }
  @media (max-width: 600px) {
    .hub-cards-grid, .pains-grid, .features-grid { grid-template-columns: 1fr !important; }
  }
`