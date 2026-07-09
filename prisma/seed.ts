import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      id: 'pln_000',
      name: 'basic',
      display_name: 'Basic',
      price_monthly: 0.00,
      price_yearly: 0.00,
      included_seats: 0,
      max_seats: null,
      price_per_extra_seat: null,
      included_brands: 1,
      max_brands: 1,
      price_per_extra_brand: null,
      max_influencers: 100,
      max_campaigns: null,
      can_use_api: false,
      custom_branding: true,
      priority_support: false,
      sort_order: 0,
      is_active: true,
    },
    {
      id: 'pln_001',
      name: 'solo',
      display_name: 'Solo',
      price_monthly: 19.00,
      price_yearly: 15.00,
      included_seats: 9999,
      max_seats: 9999,
      price_per_extra_seat: 9.00,
      included_brands: 1,
      max_brands: 1,
      price_per_extra_brand: 0.00,
      max_influencers: 100,
      max_campaigns: 3,
      can_use_api: false,
      custom_branding: false,
      priority_support: false,
      sort_order: 1,
      is_active: true,
    },
    {
      id: 'pln_002',
      name: 'team',
      display_name: 'Team',
      price_monthly: 49.00,
      price_yearly: 39.00,
      included_seats: 10,
      max_seats: 25,
      price_per_extra_seat: 7.00,
      included_brands: 3,
      max_brands: 10,
      price_per_extra_brand: 19.00,
      max_influencers: 500,
      max_campaigns: 10,
      can_use_api: true,
      custom_branding: false,
      priority_support: true,
      sort_order: 2,
      is_active: true,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.id },
      update: plan,
      create: plan,
    });
  }

  console.log(`Seeded ${plans.length} subscription plans.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });