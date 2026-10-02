import { PrismaClient } from "../prisma-clients/client/index.js";
import { seedLogin, seedMenus, seedTenantData } from "../utils/seedTenant.js";

const target = process.argv[2] || "all";

export async function seed() {
  console.log(`🌱 Starting database seed (${target})...`);
  const prisma = new PrismaClient();
  try {
    if (target === "login") {
      await seedLogin(prisma);
    } else if (target === "menus") {
      await seedMenus(prisma);
    } else {
      await seedTenantData(prisma);
    }
    console.log("✅ Seed data created successfully");
  } catch (err) {
    console.error("Seed error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((err) => console.error("Seed failed:", err));
