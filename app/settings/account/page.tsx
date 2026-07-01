"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  name: string;
  display_name: string;
  max_brands: number | null;
  included_brands: number;
  max_seats: number | null;
  included_seats: number;
  price_per_extra_seat: number | string;
  can_use_api: boolean;
  custom_branding: boolean;
  priority_support: boolean;
}

interface Subscription {
  plan: Plan;
  billing_cycle: string;
  status: string;
  current_period_end: string | null;
}

interface Profile {
  name: string | null;
  email: string | null;
  image: string | null;
}

interface PlanItem {
  icon: string;
  text: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_BADGE_COLORS: Record<string, string> = {
  solo: "bg-stone-100 text-stone-700",
  team: "bg-emerald-50 text-emerald-800",
  agency: "bg-amber-50 text-amber-800",
};

const PLAN_LABELS: Record<string, string> = {
  solo: "Solo",
  team: "Team",
  agency: "Agency",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPlanItems(subscription: Subscription, brandCount: number): PlanItem[] {
  const { plan } = subscription;
  const maxBrands = plan.max_brands ?? plan.included_brands;
  const maxSeats = plan.max_seats ?? plan.included_seats;
  const items: PlanItem[] = [];

  if (maxBrands === null || maxBrands > 100) {
    items.push({ icon: "▸", text: `${brandCount} Brands — Unlimited` });
  } else {
    items.push({ icon: "▸", text: `${brandCount} of ${maxBrands} Brands used` });
  }

  if (maxSeats === null || maxSeats > 100) {
    items.push({ icon: "▸", text: "Collaborators — Unlimited" });
  } else {
    const seatText =
      plan.included_seats > 0
        ? `${maxSeats} collaborator seats included`
        : `Up to ${maxSeats} collaborators (paid add-on: $${Number(plan.price_per_extra_seat)}/seat)`;
    items.push({ icon: "▸", text: seatText });
  }

  if (plan.can_use_api) items.push({ icon: "★", text: "API Access — Active" });
  if (plan.custom_branding) items.push({ icon: "★", text: "Custom Branding — Active" });
  if (plan.priority_support) items.push({ icon: "★", text: "Priority Support — Active" });

  return items;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-emerald-500 mb-4">
      {children}
    </p>
  );
}

function Divider() {
  return (
    <div
      className="my-6 h-px"
      style={{ background: "linear-gradient(to right, transparent, #e7e5e0, transparent)" }}
    />
  );
}

function PlanBadge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`text-[11px] font-semibold tracking-[0.08em] uppercase px-2.5 py-1 rounded-md ${colorClass}`}>
      {label}
    </span>
  );
}

function UsageRow({ icon, text }: PlanItem) {
  return (
    <div className="flex items-center gap-2.5 py-2.5 border-b border-dashed border-stone-100 last:border-none text-[13.5px] text-gray-700">
      <div className="w-[22px] h-[22px] rounded-md bg-emerald-50 text-emerald-500 flex items-center justify-center text-[10px] flex-shrink-0">
        {icon}
      </div>
      <span>{text}</span>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block mb-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase text-gray-400">
      {children}
    </label>
  );
}

function FieldInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "w-full border border-stone-200 rounded-[10px] px-3.5 py-2.5",
        "text-sm bg-stone-50 text-gray-900 outline-none",
        "focus:border-emerald-500 focus:bg-white transition-colors",
        "read-only:text-gray-500 read-only:cursor-default",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

// ─── Loading Screen ───────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
        <p className="text-xs text-stone-400 tracking-widest uppercase">Loading</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountSettingsPage() {
  const { data: session, status: sessionStatus } = useSession();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [brandCount, setBrandCount] = useState<number | null>(null);

  // Local editable copy of the name field, seeded once profile loads.
  const [fullName, setFullName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch profile (name, email, image) from the single source of truth.
  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/settings/profile")
      .then((r) => r.json())
      .then((data: Profile) => {
        setProfile(data);
        setFullName(data.name ?? "");
      });
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/subscription/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: session.user.id }),
    })
      .then((r) => r.json())
      .then((data) => setSubscription(data.subscription));
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/user/brand-usage")
      .then((r) => r.json())
      .then((data) => setBrandCount(data.brandCount ?? 0));
  }, [session?.user?.id]);

  // Gate on every piece of data the first paint depends on. Don't let
  // default/empty state values (0, "", null-ish) sneak through and render
  // an unfinished form before the real data arrives.
  const isLoading =
    sessionStatus === "loading" ||
    !session ||
    !profile ||
    !subscription ||
    brandCount === null ||
    fullName === null;

  if (isLoading) return <LoadingScreen />;

  const planName = subscription.plan?.name?.toLowerCase() ?? "solo";
  const planLabel = PLAN_LABELS[planName] ?? "Solo";
  const planColor = PLAN_BADGE_COLORS[planName] ?? PLAN_BADGE_COLORS.solo;
  const planItems = buildPlanItems(subscription, brandCount);

  const subscriptionRows = [
    { label: "Current Plan", value: subscription.plan?.display_name ?? planLabel },
    { label: "Billing Cycle", value: subscription.billing_cycle },
    { label: "Status", value: subscription.status },
    {
      label: "Renewal Date",
      value: subscription.current_period_end
        ? new Date(subscription.current_period_end).toLocaleDateString()
        : "—",
    },
  ];

  async function handleSaveName() {
    if (!fullName?.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fullName }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile((prev) => (prev ? { ...prev, name: updated.name } : prev));
        setFullName(updated.name ?? fullName);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidebarProvider className="flex w-full">
      <div className="flex w-full min-h-screen font-sans" style={{ background: "#f7f5f2" }}>
        {/* Sidebar */}
        <div className="w-[350px] flex-shrink-0">
          <AppSidebar />
        </div>

        {/* Main */}
        <main className="flex-1 min-h-screen px-10 py-12">

          {/* Header */}
          <div className="mb-12 animate-[fadeUp_0.4s_ease_both]">
            <SectionLabel>Your Account</SectionLabel>
            <h1 className="font-serif text-4xl font-semibold text-gray-900 leading-tight tracking-tight">
              Account Settings
            </h1>
            <p className="mt-2 text-sm text-stone-400 font-light">
              Manage your profile, plan, and usage details.
            </p>
          </div>

          {/* Top grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Profile Card */}
            <section className="bg-white border border-stone-200 rounded-[20px] p-8 flex flex-col hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08)] transition-shadow">
              <SectionLabel>Profile</SectionLabel>

              {/* Avatar row */}
              <div className="flex items-center gap-5 mb-6">
                <div
                  className="rounded-full flex-shrink-0 p-[3px]"
                  style={{ background: "linear-gradient(135deg, #10b981, #34d399)" }}
                >
                  <img
                    src={profile.image ?? "/avatars/instroom.jpg"}
                    alt="Avatar"
                    className="w-[72px] h-[72px] rounded-full object-cover block border-[3px] border-white"
                  />
                </div>
                <div>
                  <p className="text-[15px] font-medium text-gray-900">{fullName}</p>
                  <p className="text-[13px] text-stone-400">{profile.email}</p>
                  <span className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    Active
                  </span>
                </div>
              </div>

              <Divider />

              {/* Fields */}
              <div className="space-y-4">
                <div>
                  <FieldLabel>Full Name</FieldLabel>
                  <div className="flex gap-2">
                    <FieldInput
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="flex-1"
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={saving}
                      className="px-3.5 py-2 rounded-lg border border-emerald-500 bg-emerald-500 text-white text-[13px] font-medium hover:bg-emerald-600 hover:border-emerald-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
                <div>
                  <FieldLabel>Email Address</FieldLabel>
                  <FieldInput
                    type="email"
                    value={profile.email ?? ""}
                    readOnly
                  />
                </div>
              </div>
            </section>

            {/* Subscription Card */}
            <section className="bg-white border border-stone-200 rounded-[20px] p-8 flex flex-col hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08)] transition-shadow">
              <div className="flex items-start justify-between mb-6">
                <SectionLabel>Subscription</SectionLabel>
                <PlanBadge label={planLabel} colorClass={planColor} />
              </div>

              <div>
                {subscriptionRows.map((row) => (
                  <div key={row.label} className="flex items-center gap-3 py-2.5 border-b border-dashed border-stone-100 last:border-none">
                    <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-gray-400 min-w-[110px]">
                      {row.label}
                    </span>
                    <span className="text-[13.5px] text-gray-900">{row.value}</span>
                  </div>
                ))}
              </div>

              <Divider />

              <button className="mt-auto self-start px-4.5 py-2.5 rounded-[10px] border-[1.5px] border-emerald-500 text-emerald-900 text-[13px] font-medium hover:bg-emerald-500 hover:text-white transition-colors">
                Manage Plan →
              </button>
            </section>
          </div>

          {/* Plan Usage Card */}
          <section className="bg-white border border-stone-200 rounded-[20px] p-8 mt-6 hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08)] transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <SectionLabel>Plan Usage & Limits</SectionLabel>
              <PlanBadge label={`${planLabel} Plan`} colorClass={planColor} />
            </div>
            <Divider />
            <div>
              {planItems.map((item, i) => (
                <UsageRow key={i} {...item} />
              ))}
            </div>
          </section>
        </main>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </SidebarProvider>
  );
}