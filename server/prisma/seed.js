import { PrismaClient } from "../prisma-clients/client/index.js";

export default async function seed() {
  console.log("🌱 Starting database seed...");

  const prisma = new PrismaClient();

  try {
    // === СОЗДАЁМ ИЛИ НАХОДИМ АДМИНА ===
    const user = await prisma.users.upsert({
      where: { username: "admin" },
      update: {},
      create: {
        username: "root",
        password:
          "$2b$10$iOgDrBgGzTqU5QmyHSqA8OeFbfrDU1Bkh8v0i50amJah6X9XUZC6y",
        access_level: "absolute",
        language: "ru",
        theme: "light",
        sidebar: "opened",
        status: true,
      },
    });

    // === ОСНОВНЫЕ МЕНЮ ===
    const home = await prisma.menus.upsert({
      where: { name: "home" },
      update: {},
      create: { name: "home", path: "/home", sort_order: 1 },
    });

    const hr = await prisma.menus.upsert({
      where: { name: "hr" },
      update: {},
      create: { name: "hr", path: "/hr", sort_order: 2 },
    });

    const finance = await prisma.menus.upsert({
      where: { name: "finance" },
      update: {},
      create: { name: "finance", path: "/finance", sort_order: 3 },
    });

    const vehiclePasses = await prisma.menus.upsert({
      where: { name: "vehicle-passes" },
      update: {},
      create: {
        name: "vehicle-passes",
        path: "/vehicle-passes",
        sort_order: 4,
      },
    });

    const settings = await prisma.menus.upsert({
      where: { name: "settings" },
      update: {},
      create: { name: "settings", path: "/settings", sort_order: 5 },
    });

    // === ДОЧЕРНИЕ МЕНЮ HR ===
    const hrChildren = [
      { name: "employees", path: "/employees" },
      { name: "attendance", path: "/attendance" },
      { name: "late-employees", path: "/late-employees" },
      { name: "time-off", path: "/time-off" },
      { name: "timesheet", path: "/timesheet" },
      { name: "face-passes", path: "/face-passes" },
      { name: "holidays", path: "/holidays" },
      { name: "work-schedules", path: "/work-schedules" },
      { name: "departments", path: "/departments" },
      { name: "positions", path: "/positions" },
    ];

    for (const [i, item] of hrChildren.entries()) {
      await prisma.menus.upsert({
        where: { name: item.name },
        update: {},
        create: { ...item, parent_id: hr.id, sort_order: i + 1 },
      });
    }

    const financeChildren = [
      { name: "salary-settings", path: "/salary-settings" },
      { name: "payroll", path: "/payroll" },
      { name: "salary-payouts", path: "/salary-payouts" },
      { name: "salary-advances", path: "/salary-advances" },
    ];

    for (const [i, item] of financeChildren.entries()) {
      await prisma.menus.upsert({
        where: { name: item.name },
        update: {},
        create: { ...item, parent_id: finance.id, sort_order: i + 1 },
      });
    }

    // === ДОЧЕРНИЕ МЕНЮ SETTINGS ===
    const settingsChildren = [
      { name: "users", path: "/users" },
      { name: "branches", path: "/branches" },
      { name: "doors", path: "/doors" },
      { name: "face-devices", path: "/face-devices" },
      { name: "gates", path: "/gates" },
      { name: "vehicle-cameras", path: "/vehicle-cameras" },
      { name: "telegram-bots", path: "/telegram-bots" },
    ];

    for (const [i, item] of settingsChildren.entries()) {
      await prisma.menus.upsert({
        where: { name: item.name },
        update: {},
        create: { ...item, parent_id: settings.id, sort_order: i + 1 },
      });
    }

    // === ВЫДАЧА ДОСТУПА АДМИНУ ===
    const allMenus = await prisma.menus.findMany();

    await prisma.user_menu_access.createMany({
      data: allMenus.map((menu) => ({
        user_id: user.id,
        menu_id: menu.id,
        can_view: true,
        can_add: true,
        can_update: true,
        can_delete: true,
      })),
      skipDuplicates: true,
    });

    console.log("✅ Seed data created successfully");
  } catch (err) {
    console.error("Seed error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((err) => console.error("Seed failed:", err));
