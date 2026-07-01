// table-sheet/types.ts
// All shared types for the TableSheet feature

export type InfluencerRow = {
  id: string; handle: string; platform: string; full_name: string; email: string;
  follower_count: string | number; engagement_rate: string | number; niche: string; contact_status: string;
  stage: string; agreed_rate: string; notes: string; custom: Record<string, string>;
  gender?: string; location?: string; social_link?: string; first_name?: string;
  contact_info?: string; approval_status?: "Approved" | "Declined" | "Pending";
  transferred_date?: string; approval_notes?: string; decline_reason?: string;
  tier?: string; community_status?: string; bio?: string; profile_image_url?: string;
  avg_likes?: string | number; avg_comments?: string | number; avg_views?: string | number;
  created_at?: string;
  updated_at?: string;
  post_url?: string | null;
  post_caption?: string | null;
  likes_count?: number | string;
  comments_count?: number | string;
  engagement_count?: number | string;
  posted_at?: string | null;
  content_posted?: boolean;
}

export type CustomColumn = {
  id: string; field_key: string; field_name: string;
  field_type: "text" | "number" | "dropdown" | "multi-select" | "date" | "boolean" | "url";
  field_options?: string[];
  assignedGroup: "Influencer Details" | "Approval Details" | "Outreach Details";
  description?: string;
}

export type SortOrder = "newest" | "oldest"

export type CellAddress = { rowIdx: number; colIdx: number }

export type ColDef = {
  key: string; label: string;
  group: "Influencer Details" | "Approval Details" | "Outreach Details";
  minWidth: number;
  type: "text" | "number" | "select" | "url" | "date";
  options?: string[];
  isCustom?: false;
}

export type CustomColDef = {
  key: string; label: string;
  group: "Influencer Details" | "Approval Details" | "Outreach Details" | "Custom Fields";
  minWidth: number;
  type: "text" | "number" | "dropdown" | "multi-select" | "date" | "boolean" | "url";
  options?: string[];
  isCustom: true; customId: string; fieldKey: string;
  assignedGroup: "Influencer Details" | "Approval Details" | "Outreach Details";
}

export type AnyColDef = ColDef | CustomColDef

export type FilterState = {
  approval: string;
  dateFrom: string;
  dateTo: string;
  platform: string;
  niche: string;
  location: string;
  gender: string;
}

export type ToastNotification = {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
}