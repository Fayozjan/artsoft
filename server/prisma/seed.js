import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default async function seed() {
  console.log("🌱 Starting database seed...");

  // === СОЗДАЁМ ИЛИ НАХОДИМ АДМИНА ===
  const user = await prisma.users.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: "$2b$10$iOgDrBgGzTqU5QmyHSqA8OeFbfrDU1Bkh8v0i50amJah6X9XUZC6y",
      access_level: "absolute",
      branches: [],
      departments: [],
      language: "ru",
      theme: "light",
      sidebar: "opened",
      status: true,
    },
  });

  // === ОСНОВНЫЕ МЕНЮ ===
  const dashboard = await prisma.menus.upsert({
    where: { name: "dashboard" },
    update: {},
    create: { name: "dashboard", path: "/dashboard", sort_order: 1 },
  });

  const hr = await prisma.menus.upsert({
    where: { name: "hr" },
    update: {},
    create: { name: "hr", path: "/hr", sort_order: 2 },
  });

  const manufacturing = await prisma.menus.upsert({
    where: { name: "manufacturing" },
    update: {},
    create: { name: "manufacturing", path: "/manufacturing", sort_order: 3 },
  });

  const settings = await prisma.menus.upsert({
    where: { name: "settings" },
    update: {},
    create: { name: "settings", path: "/settings", sort_order: 4 },
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
  ];

  for (const [i, item] of hrChildren.entries()) {
    await prisma.menus.upsert({
      where: { name: item.name },
      update: {},
      create: { ...item, parent_id: hr.id, sort_order: i + 1 },
    });
  }

  // === ДОЧЕРНИЕ МЕНЮ SETTINGS ===
  const settingsChildren = [
    { name: "users", path: "/users" },
    { name: "branches", path: "/branches" },
    { name: "departments", path: "/departments" },
    { name: "positions", path: "/positions" },
    { name: "doors", path: "/doors" },
    { name: "face-devices", path: "/face-devices" },
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
      can_create: true,
      can_update: true,
      can_delete: true,
    })),
    skipDuplicates: true,
  });

  console.log("✅ Seed data created successfully");

  await prisma.$disconnect();
}
