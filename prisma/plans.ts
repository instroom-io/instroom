import { prisma } from "@/lib/prisma";

export async function getActivePlans() {
  return prisma.subscriptionPlan.findMany({
    where: { is_active: true },
    orderBy: { sort_order: "asc" },
  });
}