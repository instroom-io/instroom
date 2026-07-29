// "Early Access" isn't tracked by its own DB flag (no such column exists) —
// for this MVP it's defined as anyone who signed up before this cutoff.
// Update this constant if/when a real "early access phase" needs redefining.
export const EARLY_ACCESS_CUTOFF = new Date("2026-07-29T00:00:00.000Z")
