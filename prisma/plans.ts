import { prisma } from "@/lib/prisma";

export async function getActivePlans() {
  try {
    return await prisma.subscriptionPlan.findMany({
      where: { is_active: true },
      orderBy: { sort_order: "asc" },
    });
  } catch (error) {
    // Don't let a missing/unavailable table crash the render (e.g. build-time
    // prerender or before migrations are applied). Return an empty list so the
    // page can still render its empty state.
    console.error("getActivePlans failed:", error);
    return [];
  }
}