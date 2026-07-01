// table-sheet/index.ts
// Barrel export — import everything from this single entry point
//
// Usage in your pages:
//   import TableSheet from "@/components/table-sheet"
//   import type { InfluencerRow, CustomColumn } from "@/components/table-sheet"

export { default } from "./table-sheet"              // main component
export type { InfluencerRow, CustomColumn, SortOrder, FilterState } from "./types"